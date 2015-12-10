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
deasync = require 'deasync'
# expose imageHelper
imageHelper = exports = module.exports = class ImageHelper


  @imageExists: (md5, callback) ->
    imagePath = nconf.get('paths:imageRootPath')

    fs.stat imagePath + '/' + md5 + '/input.png', (err, stat) ->
      if (!err?)
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
  @saveImage: (image) ->
    #code for saving an image
    imagePath = nconf.get('paths:imageRootPath')
    base64Data = image.replace(/^data:image\/png;base64,/, "")
    md5String = md5(base64Data)
    image = {}
    sync = false
    self = @
    fs.mkdir imagePath + '/' + md5String, (err) ->
      return
    imgFolder = imagePath + '/' + md5String + '/'
    fs.stat imagePath + '/' + md5String + '/' + 'input.png', (err, stat) ->
      image =
        folder: imgFolder
        path: imgFolder + 'input.png'
        md5: md5String

      if !err?
        sync = true
        return
      else if err.code == 'ENOENT'
        fs.writeFile imgFolder + 'input.png', base64Data, 'base64', (err) ->
          return
        return
      else
        #error handling
    while(!sync)
      require('deasync').sleep(100)
    return image
  # ---
  # **saveImageUrl**</br>
  # saves an image to the disk coming from a URL
  # the path to the image will be: server.NODE_ENV.json["paths"]["imageRootPath"]/md5Hash/input.EXTENSION
  #   where:
  #     *md5Hash* is the md5Hash of the received image
  #     *EXTENSION* is the image extension</br>
  # `params`
  #   *url* the URL to the image
  @saveImageUrl: (url) ->
    imagePath = nconf.get('paths:imageRootPath')
    self = @
    image = {}
    sync = false
    request(url).pipe(fs.createWriteStream(imagePath + '/temp.png')).on 'close', (cb) ->
      base64 = fs.readFileSync imagePath + '/temp.png', 'base64'
      md5String = md5(base64)
      imgFolder = imagePath + '/' + md5String + '/'
      image =
        folder: imgFolder
        path:  imgFolder + 'input.png'
        md5: md5String
      #console.log result
      fs.mkdir imagePath + '/' + md5String, (err) ->
        return

      fs.stat image.path, (err, stat) ->
        if !err?
          fs.unlink(imagePath + '/temp.png')
          sync = true
          return
        else if err.code == 'ENOENT'
          source = fs.createReadStream imagePath + '/temp.png'
          dest = fs.createWriteStream image.path
          source.pipe(dest)
          source.on 'end', () ->
            fs.unlink(imagePath + '/temp.png')
            sync = true
            return
          source.on 'error', (err) ->
            console.log err
            sync = true
            return
          return
      return
    while(!sync)
      require('deasync').sleep(100)
    return image


  @loadImageMd5: (md5) ->
    imagePath = nconf.get('paths:imageRootPath')
    imgFolder = imagePath + '/' + md5 + '/'
    self = @
    image = {}
    sync = false
    fs.stat imagePath + '/' + md5 + '/input.png', (err,stat) ->
      image =
        folder: imgFolder
        path: imgFolder + 'input.png'
        md5: md5
      sync = true
      return
    while(!sync)
      require('deasync').sleep(100)
    return image


  @getInputImageUrl: (md5) ->
    rootUrl = nconf.get('server:rootUrl')
    outputUrl = 'http://' + rootUrl + '/static/' + md5 + '/input.png'
    return outputUrl

  @getOutputImageUrl: (md5) ->
    rootUrl = nconf.get('server:rootUrl')
    outputUrl = 'http://' + rootUrl + '/static/' + md5 + '/output.png'
    return outputUrl


