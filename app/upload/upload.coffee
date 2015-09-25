ImageHelper = require '../helper/imageHelper'

upload = exports = module.exports = class Upload

  @imageHelper = new ImageHelper()

  @uploadUrl: (url, callback) ->
    @imageHelper.saveImageUrl(url, callback)

  @uploadBase64: (base64, callback) ->
    console.log 'upload base64'
    @imageHelper.saveImage(base64,callback)