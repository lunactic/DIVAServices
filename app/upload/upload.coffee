ImageHelper = require '../helper/imageHelper'
RandomWordGenerator = require '../randomizer/randomWordGenerator'

upload = exports = module.exports = class Upload

  @imageHelper = new ImageHelper()

  @uploadUrl: (url, callback) ->
    randomFolder = RandomWordGenerator.generateRandomWord()
    image = ImageHelper.saveImageUrl(url,randomFolder,0)
    callback null, image

  @uploadBase64: (base64, callback) ->
    randomFolder = RandomWordGenerator.generateRandomWord()
    image = ImageHelper.saveOriginalImage(base64,randomFolder,0)
    callback null, image