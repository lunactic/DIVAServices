# ImageHelper
# =======
#
# **ImageHelper** provides helper methods for handling images
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependencies
_                     = require 'lodash'
async                 = require 'async'
deasync               = require 'deasync'
fs                    = require 'fs'
IoHelper              = require '../helper/ioHelper'
md5                   = require 'md5'
nconf                 = require 'nconf'
path                  = require 'path'
request               = require 'request'
logger                = require '../logging/logger'

# expose imageHelper
imageHelper = exports = module.exports = class ImageHelper

  @imageInfo ?= JSON.parse(fs.readFileSync(nconf.get('paths:imageInfoFile'),'utf-8'))


  @saveImage: (inputImage, process, numberOfImages, counter) ->
    self = @
    switch inputImage.type
      when 'image'
        image = @saveOriginalImage(inputImage.value,process.rootFolder,counter, (image) ->
          self.addImageInfo(image.md5, image.path, process.rootFolder)
          self.updateCollectionInformation(process.rootFolder, numberOfImages, counter)
        )
      when 'url'
        image = @saveImageUrl(inputImage.value,process.rootFolder, counter, (image) ->
          self.addImageInfo(image.md5, image.path, process.rootFolder)
          self.updateCollectionInformation(process.rootFolder, numberOfImages, counter)
        )

    return

  @imageExists: (md5, callback) ->
    filtered = @imageInfo.filter (item) ->
      return item.md5 == md5
    if(filtered.length > 0)
      callback null, {imageAvailable: true}
    else
      callback null, {imageAvailable: false}

  # ---
  # **saveImage**</br>
  # saves a base64 image to the disk
  # the path to the image will be: server.NODE_ENV.json["paths"]["imageRootPath"]/md5Hash/input.EXTENSION
  #   where:
  #     *md5Hash* is the md5Hash of the received image
  #     *EXTENSION* is the image extension</br>
  # `params`
  #   *image* the received base64 encoded image
  @saveOriginalImage: (image, folder, counter, callback) ->
    #code for saving an image
    imagePath = nconf.get('paths:imageRootPath')
    base64Data = image.replace(/^data:image\/png;base64,/, "")
    md5String = md5(base64Data)
    if(!folder?)
      folder = md5String
    if(!counter?)
      counter = ''
    image = {}

    imgFolder = imagePath + path.sep + folder + path.sep + 'original' + path.sep
    imgName = 'input' + counter
    imgExtension = getImageExtensionFromBase64(base64Data)
    fs.stat imgFolder + imgName, (err, stat) ->
      image =
        rootFolder: path.join(path.dirname(imgFolder),'..')
        folder: imgFolder
        name: imgName
        extension: imgExtension
        path:  imgFolder + imgName + '.' + imgExtension
        md5: md5String
      if !err?
        return image
      else if err.code == 'ENOENT'
        fs.writeFile image.path, base64Data, 'base64', (err) ->
          callback image
        return
      else
        #error handling

  @saveImageJson: (image,process) ->
    process.image.extension = getImageExtensionFromBase64(image)
    base64Data = image.replace(/^data:image\/png;base64,/, "")
    fs.writeFileSync(process.outputFolder + '/' + process.image.name + '.' + process.image.extension,base64Data, 'base64')


  # ---
  # **saveImageUrl**</br>
  # saves an image to the disk coming from a URL
  # the path to the image will be: server.NODE_ENV.json["paths"]["imageRootPath"]/md5Hash/input.EXTENSION
  #   where:
  #     *md5Hash* is the md5Hash of the received image
  #     *EXTENSION* is the image extension</br>
  # `params`
  #   *url* the URL to the image
  @saveImageUrl: (url, folder, counter, cb) ->
    if(!counter?)
      counter = ''
    imagePath = nconf.get('paths:imageRootPath') + '/' + folder + '/'
    image = {}
    async.waterfall [
      (callback) ->
        request.head(url).on('response', (response) ->
          imgExtension = getImageExtension(response.headers['content-type'])
          callback null, imgExtension
        )
      (imgExtension, callback) ->
        console.log 'begin image download at url: ' + url
        console.log 'temp path: ' + imagePath + 'temp_' + counter + '.' + imgExtension
        request(url).pipe(fs.createWriteStream(imagePath + 'temp_' + counter + '.' + imgExtension)).on 'close', (cb) ->
          console.log 'finished image download'
          base64 = fs.readFileSync imagePath + 'temp_' + counter + '.' + imgExtension, 'base64'
          md5String = md5(base64)
          if(!folder?)
            folder = md5String
          imgFolder = imagePath + 'original/'
          imgName = 'input' + counter
          image =
            rootFolder: path.join(path.dirname(imgFolder),'..')
            folder: imgFolder
            name: imgName
            extension: imgExtension
            path: imgFolder + imgName + '.' +imgExtension
            md5: md5String
          console.log 'begin fs.stat'
          fs.stat image.path, (err, stat) ->
            if !err?
              console.log 'image exists'
              fs.unlink(imagePath + 'temp_' + counter + '.' + imgExtension)
              callback null, image
            else if err.code == 'ENOENT'
              console.log 'copy image'
              source = fs.createReadStream imagePath + 'temp_' + counter + '.' + imgExtension
              dest = fs.createWriteStream image.path
              source.pipe(dest)
              source.on 'end', () ->
                fs.unlink(imagePath + 'temp_' + counter + '.' + imgExtension)
                callback null, image
              source.on 'error', (err) ->
                logger.log 'error', err
                callback null, image
    ], (err, image) ->
      if(err?)
        logger.log 'error', err
      cb image

  #Loads all images given an md5 hash
  @loadImagesMd5: (md5) ->
    filtered = @imageInfo.filter (item) ->
      return item.md5 == md5

    images = []
    sync = false

    for item,i in filtered
      imagePath = filtered[i].file
      image = {}
      extension = path.extname(imagePath)
      filename = path.basename(imagePath,extension)
      fs.stat imagePath, (err,stat) ->
      image =
          rootFolder: path.join(path.dirname(imagePath),'..')
          folder: path.dirname(imagePath)
          name: filename
          extension: extension.substring(1)
          path: imagePath
          md5: md5
      images.push image
    sync = true
    return images

    while(!sync)
      require('deasync').sleep(100)
    return images

  @getAllCollections: () ->
    collections = []
    imageInfo = IoHelper.loadFile(nconf.get('paths:imageInfoFile'))
    _.forEach(imageInfo, (image) ->
      if !(collections.indexOf(image.collection) > -1)
        collections.push(image.collection)
    )
    return collections



  @loadCollection: (collectionName, newCollection) ->
    if(!newCollection)
      filtered = _.filter(@imageInfo, (image) ->
        return image.collection is collectionName
      )
      if(filtered.length > 0)
        images = []
        imagePath = nconf.get('paths:imageRootPath')
        imgFolder = imagePath + '/' + collectionName + '/'
        for item in filtered
          filename = path.basename(item.file).split('.')[0]
          extension = path.extname(item.file).replace('.','')
          image =
            folder: imagePath + '/' + collectionName + '/'
            name: filename
            extension: extension
            path: item.file
            md5: item.md5
          images.push(image)
        return images
      else
        logger.log 'error', 'Tried to load collection: ' + collectionName + ' which does not exist.'
        return []
    else
      imagePath = nconf.get('paths:imageRootPath')
      imgFolder = imagePath + '/' + collectionName + '/'
      images = []
      try
        fs.statSync(imgFolder)
        fs.statSync(imgFolder + '/original/')
        files = fs.readdirSync imgFolder + '/original/'
        for file in files
          base64 = fs.readFileSync imgFolder + '/original/' +file, 'base64'
          md5String = md5(base64)
          filename = file.split('.')
          image =
            folder: imagePath + '/' + collectionName + '/'
            name: filename[0]
            extension: filename[1]
            path: imgFolder + 'original/'+ file
            md5: md5String
          images.push(image)
        return images
      catch error
        logger.log 'error', 'Tried to load collection: ' + collectionName + ' which does not exist.'
        return []

  @getOutputImage: (image, folder) ->
    return folder + path.sep + image.name + '.' + image.extension

  @getInputImageUrl: (folder, filename, extension) ->
    rootUrl = nconf.get('server:rootUrl')
    outputUrl = 'http://' + rootUrl + '/static/' + folder + '/original/' + filename + '.' + extension
    return outputUrl

  @getOutputImageUrl: (folder, filename, extension) ->
    rootUrl = nconf.get('server:rootUrl')
    outputUrl = 'http://' + rootUrl + '/static/' + folder + '/' + filename + '.' + extension
    return outputUrl

  @addImageInfo: (md5,file, collection) ->
    @imageInfo.push {md5:md5, file:file, collection: collection}
    @saveImageInfo()

  @getImageInfo: (md5) ->
    return _.find @imageInfo, (info) ->
      return info.md5 == md5

  @addImageInfoCollection: (collection) ->
    images = @loadCollection(collection, true)
    for image in images
      @addImageInfo(image.md5, image.path, collection)

  @saveImageInfo: () ->
    fs.writeFileSync nconf.get('paths:imageInfoFile'),JSON.stringify(@imageInfo, null, '\t'), 'utf8'

  @handleMd5: (image, process, collection, serviceInfo, parameterHelper,req) ->
    rootFolder = image.folder.split(path.sep)[image.folder.split(path.sep).length-2]
    #Overwrite the root folder
    process.rootFolder = rootFolder
    collection.name = rootFolder
    folder = nconf.get('paths:imageRootPath') + path.sep + collection.name
    collection.parameters = parameterHelper.matchParams(req.body.inputs, req.body.highlighter.segments,serviceInfo.parameters,folder,folder, "", req)
    collection.inputParameters = _.clone(req.body.inputs)
    collection.inputHighlighters = _.clone(req.body.highlighter)
    return

  @createCollectionInformation: (collectionName, numberOfImages) ->
    status =
      statusCode: 110
      statusMessage: 'Downloaded 0 of ' + numberOfImages + ' images'
      percentage: 0
    statusFile = nconf.get('paths:imageRootPath') + '/' + collectionName + '/' + 'status.json'
    fs.writeFileSync statusFile,JSON.stringify(status, null, '\t'), 'utf8'
    return

  @checkCollectionAvailable: (collectionName) ->
    try
      stats = fs.statSync(nconf.get('paths:imageRootPath') + '/' + collectionName)
      return true
    catch error
      return false


  @updateCollectionInformation: (collectionName, numberOfImages, numberOfDownloadedImages) ->
    if(numberOfDownloadedImages isnt numberOfImages )
      status =
        statusCode: 110
        statusMessage: 'Downloaded ' + numberOfDownloadedImages + ' of ' + numberOfImages + 'images'
        percentage: (numberOfDownloadedImages / numberOfImages) * 100
    else
      status =
        statusCode: 200
        statusMessage: 'Collection is available'
        percentage: 100

    statusFile = nconf.get('paths:imageRootPath') + '/' + collectionName + '/' + 'status.json'
    fs.writeFileSync statusFile,JSON.stringify(status, null, '\t'), 'utf8'
    return

  @getCollectionInformation: (collectionName) ->
    statusFile = nconf.get('paths:imageRootPath') + '/' + collectionName + '/' + 'status.json'
    status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'))
    return status

  getImageExtension = (contentType) ->
    switch (contentType)
      when "image/jpeg"
        return 'jpg'
      when "image/tiff"
        return 'tiff'
      when "image/png"
        return 'png'

  getImageExtensionFromBase64 = (base64) ->
    if(base64.indexOf('/9j/4AAQ') != -1 or base64.indexOf('_9j_4AA') != -1)
      return 'jpg'
    if(base64.indexOf('iVBORw0KGgoAAAANSUhEU') != -1)
      return 'png'