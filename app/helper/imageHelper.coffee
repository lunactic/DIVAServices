# ImageHelper
# =======
#
# **ImageHelper** provides helper methods for handling images
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependencies
nconf = require 'nconf'
md5   = require 'md5'
fs    = require 'fs'
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
    fs.mkdir imagePath + '/' + md5String, (err) ->
      #we don't care if the folder exists
      return
    this.imgFolder = imagePath + '/' + md5String + '/'
    fs.stat imagePath + '/' + md5String + '/input.png', (err, stat) ->
      if !err?
        console.log 'file exists already'
        callback null, imagePath + '/' + md5String + '/input.png'
      else if err.code == 'ENOENT'
        fs.writeFile imagePath + '/' + md5String + '/input.png', base64Data, 'base64', (err) ->
          return
        callback null, imagePath + '/' + md5String + '/input.png'
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
      self.imgFolder = imagePath + '/' + md5String + '/'
      fs.mkdir imagePath + '/' + md5String, (err) ->
        #we don't care if the folder exists
        return
      fs.stat imagePath + '/' + md5String + '/input.png', (err, stat) ->
        if !err?
          console.log 'file exists already'
          callback null, imagePath + '/' + md5String + '/input.png'
        else if err.code == 'ENOENT'
          source = fs.createReadStream imagePath + '/temp.png'
          dest = fs.createWriteStream imagePath + '/' + md5String + '/input.png'
          source.pipe(dest)
          source.on 'end', () ->
            callback null, imagePath + '/' + md5String + '/input.png'
            return
          source.on 'error', (err) ->
            callback err
            return
