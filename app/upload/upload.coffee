fs = require 'fs'
ImageHelper = require '../helper/imageHelper'
IoHelper = require '../helper/ioHelper'
logger = require '../logging/logger'
nconf = require 'nconf'
path = require 'path'
RandomWordGenerator = require '../randomizer/randomWordGenerator'


upload = exports = module.exports = class Upload

  @ioHelper = new IoHelper()
  @imageHelper = new ImageHelper()

  @uploadUrl: (url, callback) ->
    randomFolder = RandomWordGenerator.generateRandomWord()
    @ioHelper.createCollectionFolders(randomFolder)
    image = ImageHelper.saveImageUrl(url, randomFolder, 0)
    ImageHelper.addImageInfo(image.md5, image.path, randomFolder)
    callback null, image

  @uploadBase64Image: (base64, callback) ->
    randomFolder = RandomWordGenerator.generateRandomWord()
    @ioHelper.createCollectionFolders(randomFolder)
    image = ImageHelper.saveOriginalImage(base64, randomFolder, 0)
    ImageHelper.addImageInfo(image.md5, image.path, randomFolder)
    callback null, image

  @uploadBase64Zip: (base64, callback) ->
    randomFolder = RandomWordGenerator.generateRandomWord()
    self = @
    @ioHelper.createCollectionFolders(randomFolder)
    fs.writeFile(nconf.get('paths:imageRootPath') + path.sep + randomFolder + path.sep + 'input.zip', base64, 'base64', (err) ->
      self.ioHelper.unzipFolder(nconf.get('paths:imageRootPath') + path.sep + randomFolder + path.sep + 'input.zip', nconf.get('paths:imageRootPath') + path.sep + randomFolder + path.sep + 'original', () ->
        ImageHelper.addImageInfoCollection(randomFolder)
        callback null, randomFolder
      )
    )

  @uploadZip: (url, callback) ->
    collectionName = RandomWordGenerator.generateRandomWord()
    self = @
    @ioHelper.createCollectionFolders(collectionName)
    @ioHelper.downloadFile(url, nconf.get('paths:imageRootPath') + path.sep + collectionName,null, (err, filename) ->
      self.ioHelper.unzipFolder(filename, nconf.get('paths:imageRootPath') + path.sep + collectionName + path.sep + 'original', () ->
        ImageHelper.addImageInfoCollection(collectionName)
        callback null, collectionName
      )
    )
