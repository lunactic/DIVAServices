# ImageHelper
# =======
#
# **ImageHelper** provides helper methods for handling images
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependencies
nconf   = require 'nconf'
md5     = require 'md5'
fs      = require 'fs'
request = require 'request'
# expose imageHelper
imageHelper = exports = module.exports = class ImageHelper

  # ---
  # **constructor**</br>
  # initialize image folder
  constructor: () ->
    imgFolder = ''

  # ---
  # **imgFolder**</br>
  # The folder of the current image
  imgFolder: ''

  # ---
  # **md5**</br>
  # The md5 hash of the current image
  md5: ''


  @imageExists: (md5, callback) ->
    imagePath = nconf.get('paths:imageRootPath')

    fs.stat imagePath + '/' + md5 + '/input.png', (err, stat) ->
      if (!err?)
        console.log 'image exists'
        callback null, {imageAvailable: true}
      else
        console.log 'image does not exist'
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
  saveImage: (image, callback) ->
    #code for saving an image
    imagePath = nconf.get('paths:imageRootPath')
    base64Data = image.replace(/^data:image\/png;base64,/, "")
    md5String = md5(base64Data)
    @md5 = md5String
    self = @
    console.log 'creating directory: ' + imagePath + '/' + md5String
    fs.mkdir imagePath + '/' + md5String, (err) ->
      return

    imgFolder = imagePath + '/' + md5String + '/'

    fs.stat imagePath + '/' + md5String + '/' + 'input.png', (err, stat) ->
      result =
        folder: imgFolder
        path: imgFolder + 'input.png'
        md5: self.md5
      if !err?
        callback null, result
      else if err.code == 'ENOENT'
        fs.writeFile imgFolder + 'input.png', base64Data, 'base64', (err) ->
          return
        console.log 'calling callback with result: ' + JSON.stringify(result)
        callback null, result
      else
        callback err
  # ---
  # **saveImageUrl**</br>
  # saves an image to the disk coming from a URL
  # the path to the image will be: server.NODE_ENV.json["paths"]["imageRootPath"]/md5Hash/input.EXTENSION
  #   where:
  #     *md5Hash* is the md5Hash of the received image
  #     *EXTENSION* is the image extension</br>
  # `params`
  #   *url* the URL to the image
  saveImageUrl: (url, callback ) ->
    imagePath = nconf.get('paths:imageRootPath')
    self = @
    request(url).pipe(fs.createWriteStream(imagePath + '/temp.png')).on 'close', (cb) ->
      base64 = fs.readFileSync imagePath + '/temp.png', 'base64'
      md5String = md5(base64)
      self.md5 = md5String
      self.imgFolder = imagePath + '/' + md5String + '/'
      result =
        folder: self.imgFolder
        path: self.imgFolder + 'input.png'
        md5: self.md5

      fs.mkdir imagePath + '/' + md5String, (err) ->
        #we don't care if the folder exists
        return
      fs.stat result.path, (err, stat) ->
        if !err?
          fs.unlink(imagePath + '/temp.png')
          callback null, result
        else if err.code == 'ENOENT'
          source = fs.createReadStream imagePath + '/temp.png'
          dest = fs.createWriteStream result.path
          source.pipe(dest)
          source.on 'end', () ->
            fs.unlink(imagePath + '/temp.png')
            callback null, result
            return
          source.on 'error', (err) ->
            callback err
            return

  loadImageMd5: (md5, callback) ->
    imagePath = nconf.get('paths:imageRootPath')
    @imgFolder = imagePath + '/' + md5 + '/'
    @md5 = md5
    self = @
    fs.stat imagePath + '/' + md5 + '/input.png', (err,stat) ->
      result =
        folder: self.imgFolder
        path: self.imgFolder + 'input.png'
        md5: self.md5
      callback null,result


  getInputImageUrl: (md5) ->
    rootUrl = nconf.get('server:rootUrl')
    outputUrl = 'http://' + rootUrl + '/static/' + md5 + '/input.png'
    return outputUrl

  getOutputImageUrl: (md5) ->
    rootUrl = nconf.get('server:rootUrl')
    outputUrl = 'http://' + rootUrl + '/static/' + md5 + '/output.png'
    return outputUrl


