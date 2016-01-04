ImageHelper = require '../helper/imageHelper'

upload = exports = module.exports = class Upload

  @imageHelper = new ImageHelper()

  @uploadUrl: (url, callback) ->
    @imageHelper.saveImageUrl(url, callback)

  @uploadBase64: (base64, callback) ->
    @imageHelper.saveOriginalImage(base64,callback)