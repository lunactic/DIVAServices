ImageHelper = require '../helper/imageHelper'
IoHelper    = require '../helper/ioHelper'
nconf       = require 'nconf'
path        = require 'path'
RandomWordGenerator = require '../randomizer/randomWordGenerator'


upload = exports = module.exports = class Upload

  @imageHelper = new ImageHelper()

  @uploadUrl: (url, callback) ->
    randomFolder = RandomWordGenerator.generateRandomWord()
    image = ImageHelper.saveImageUrl(url,randomFolder,0)
    ImageHelper.addImageInfo(image.md5, image.path, randomFolder)
    callback null, image

  @uploadBase64: (base64, callback) ->
    randomFolder = RandomWordGenerator.generateRandomWord()
    image = ImageHelper.saveOriginalImage(base64,randomFolder,0)
    ImageHelper.addImageInfo(image.md5, image.path, randomFolder)
    callback null, image

  @uploadZip:(url, callback) ->
    collectionName = RandomWordGenerator.generateRandomWord()
    ioHelper = new IoHelper()
    ioHelper.createCollectionFolders(collectionName)
    ioHelper.downloadFile(url,nconf.get('paths:imageRootPath') + path.sep + collectionName,(err, filename) ->
      ioHelper.unzipFolder(filename, nconf.get('paths:imageRootPath') + path.sep + collectionName + path.sep + 'original', () ->
        images = ImageHelper.loadCollection(collectionName)
        for image in images
          ImageHelper.addImageInfo(image.md5, image.path, collectionName)
        callback null, collectionName
      )
    )
