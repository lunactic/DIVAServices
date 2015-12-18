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
inputHelper = exports = module.exports = class InputHelper

  saveInput: (input, callback) ->
    imagePath = nconf.get('paths:textualRootPath')
    md5String = md5(input)
    info =
      folder: imagePath + '/' + md5String + '/'
      path: imagePath+'/'+md5String+'/input.txt'
      md5: md5String
    try
      fs.mkdirSync(imagePath + '/'+md5String)
      fs.writeFileSync(imagePath+'/'+md5String+'/input.txt',input,'utf8')
    catch error
      #no need to handle

    callback null, info


