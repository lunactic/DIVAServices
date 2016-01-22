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
md5                   = require 'md5'
nconf                 = require 'nconf'
path                  = require 'path'
request               = require 'request'
ParameterHelper       = require '../helper/parameterHelper'
logger                = require '../logging/logger'

# expose imageHelper
imageHelper = exports = module.exports = class ImageHelper

  @imageInfo ?= JSON.parse(fs.readFileSync(nconf.get('paths:imageInfoFile'),'utf-8'))


  @saveImage: (inputImage, process, counter) ->
    switch inputImage.type
      when 'image'
        image = @saveOriginalImage(inputImage.value,process.rootFolder,counter)
        @addImageInfo(image.md5, image.path)
      when 'url'
        image = @saveImageUrl(inputImage.value,process.rootFolder, counter)
        @addImageInfo(image.md5, image.path)
      when 'md5'
        image = @loadImagesMd5(inputImage.value)[0]
    return image

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
  @saveOriginalImage: (image, folder, counter) ->
    #code for saving an image
    imagePath = nconf.get('paths:imageRootPath')
    base64Data = image.replace(/^data:image\/png;base64,/, "")
    md5String = md5(base64Data)
    if(!folder?)
      folder = md5String
    if(!counter?)
      counter = ''
    image = {}
    sync = false
    try
      fs.mkdirSync imagePath + '/' + folder
      fs.mkdirSync imagePath + '/' + folder + '/original'
    catch error
    #we don't care for errors they are thrown when the folder exists

    imgFolder = imagePath + '/' + folder + '/original/'
    imgName = 'input' + counter
    imgExtension = getImageExtensionFromBase64(base64Data)
    fs.stat imgFolder + imgName, (err, stat) ->
      #TODO Create an image class
      image =
        rootFolder: path.join(path.dirname(imgFolder),'..')
        folder: imgFolder
        name: imgName
        extension: imgExtension
        path:  imgFolder + imgName + '.' + imgExtension
        md5: md5String
      if !err?
        sync = true
        return
      else if err.code == 'ENOENT'
        fs.writeFile image.path, base64Data, 'base64', (err) ->
          sync = true
          return
        return
      else
        #error handling
    while(!sync)
      require('deasync').sleep(100)
    return image

  @saveImageJson: (image,process) ->
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
  @saveImageUrl: (url, folder, counter) ->
    if(!counter?)
      counter = ''
    imagePath = nconf.get('paths:imageRootPath')
    image = {}
    sync = false
    async.waterfall [
      (callback) ->
        self = @
        request.head(url).on('response', (response) ->
          imgExtension = getImageExtension(response.headers['content-type'])
          callback null, imgExtension
        )
      (imgExtension, callback) ->
        request(url).pipe(fs.createWriteStream(imagePath + '/temp.' + imgExtension)).on 'close', (cb) ->
          base64 = fs.readFileSync imagePath + '/temp.' + imgExtension, 'base64'
          md5String = md5(base64)
          if(!folder?)
            folder = md5String
          imgFolder = imagePath + '/' + folder + '/original/'
          imgName = 'input' + counter
          image =
            rootFolder: path.join(path.dirname(imgFolder),'..')
            folder: imgFolder
            name: imgName
            extension: imgExtension
            path: imgFolder + imgName + '.' +imgExtension
            md5: md5String
            #console.log result
          try
            fs.mkdirSync imagePath + '/' + folder
            fs.mkdirSync imagePath + '/' + folder + '/original'
          catch error
            #we don't care for errors they are thrown when the folder exists

          fs.stat image.path, (err, stat) ->
            if !err?
              fs.unlink(imagePath + '/temp.' + imgExtension)
              sync = true
              callback null, image
              return
            else if err.code == 'ENOENT'
              source = fs.createReadStream imagePath + '/temp.' + imgExtension
              dest = fs.createWriteStream image.path
              source.pipe(dest)
              source.on 'end', () ->
                fs.unlink(imagePath + '/temp.' + imgExtension)
                sync = true
                callback null, image
                return
              source.on 'error', (err) ->
                console.log err
                sync = true
                callback null, image
                return
              return
            return
    ], (err, image) ->
      return image

    while(!sync)
      require('deasync').sleep(100)
    return image

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
          extension: extension
          path: imagePath
          md5: md5
      images.push image
    sync = true
    return images

    while(!sync)
      require('deasync').sleep(100)
    return images

  @loadCollection: (collectionName) ->
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

  @addImageInfo: (md5,file) ->
    @imageInfo.push {md5:md5, file:file}
    @saveImageInfo()

  @getImageInfo: (md5) ->
    return _.find @imageInfo, (info) ->
      return info.md5 == md5

  @saveImageInfo: () ->
    fs.writeFileSync nconf.get('paths:imageInfoFile'),JSON.stringify(@imageInfo), 'utf8'

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

  getImageExtension = (contentType) ->
    switch (contentType)
      when "image/jpeg"
        return 'jpg'
      when "image/tiff"
        return 'tiff'
      when "image/png"
        return 'png'

  getImageExtensionFromBase64 = (base64) ->
    if(base64.indexOf('/9j/4AAQ') != -1)
      return 'jpg'
    if(base64.indexOf('iVBORw0KGgoAAAANSUhEU') != -1)
      return 'png'