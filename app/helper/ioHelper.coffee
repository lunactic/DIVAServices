# IoHelper
# =======
#
# **IoHelper** provides helper methods for handling with files
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependecies
_         = require 'lodash'
archiver  = require 'archiver'
fs        = require 'fs'
http      = require 'http'
https     = require 'https'
mkdirp    = require 'mkdirp'
nconf     = require 'nconf'
path      = require 'path'
rmdir     = require 'rimraf'
unzip     = require 'unzip2'
url       = require 'url'
logger    = require '../logging/logger'


# expose IoHelper
ioHelper = exports = module.exports = class IoHelper

  @deleteFile: (file) ->
    fs.unlink(file)

  @deleteFolder: (folder) ->
    rmdir(folder, (err) ->
    )

  @unzipFolder: (zipFile, folder, callback) ->
    mkdirp(folder, (err) ->
      if(err)
        logger.log 'error', err
        callback err
      else
        reader = fs.createReadStream(zipFile)
        reader.pipe(unzip.Extract({path: folder})).on 'close', ->
          callback null
    )

  @zipFolder: (folder) ->
    archive = archiver('zip',{})
    folders = folder.split(path.sep)

    fullFileName = nconf.get('paths:imageRootPath') + path.sep + folders[folders.length-2] + '_' + folders[folders.length-1] + '.zip'
    fileName = folders[folders.length-2] + '_' + folders[folders.length-1] + '.zip'
    
    output = fs.createWriteStream(fullFileName)
    output.on 'close', ->
      return
    archive.on 'error', (err) ->
      console.log 'error: ' + err
      return
    archive.pipe output
    archive.bulk([
      expand: true
      cwd: folder+'/'
      src: ['*.png','**/*.png']
    ])
    archive.finalize()
    return fileName

  @getOutputFolderForImages: (rootFolder, service, unique) ->
    #check which folder is to be used
    imagePath = nconf.get('paths:imageRootPath')
    rootPath = imagePath + '/' + rootFolder
    #read all folders in the current directory
    folders = fs.readdirSync(rootPath).filter (file) ->
      fs.statSync(path.join(rootPath,file)).isDirectory()

    #filter for folders matching the service name
    folders = _.filter folders,  (folder) ->
      _.includes folder,service


    if(folders.length > 0 and not unique)
      numbers = _.invokeMap folders, String::split, '_'
      numbers = _.map(numbers, 1)
      numbers = _.map numbers, Number.parseFloat
      maxNumber = parseInt(_.max(numbers))
      return rootPath + '/' + service + '_' + (maxNumber + 1)
    else
      return rootPath + '/' + service + '_0'


  @getOutputFolderForData: (service, unique) ->
    dataPath = nconf.get('paths:dataRootPath')
    rootPath = dataPath + '/' + service.service
    #read all folders in the current rootPath
    folders = fs.readdirSync(rootPath).filter (file) ->
      fs.statSync(path.join(rootPath, file)).isDirectory()

    folders = _.filter(folders, (folder) ->
      _.includes(folder,service.service)
    )

    if(folders.length > 0 and not unique)
      numbers = _.invokeMap folders, String::split, '_'
      numbers = _.map(numbers, 1)
      numbers = _.map numbers, Number.parseFloat
      maxNumber = parseInt(_.max(numbers))
      return rootPath + '/' + service.service + '_' + (maxNumber + 1)
    else
      return rootPath + '/' + service.service + '_0'


#build file Path from outputFolder name and filename
  @buildFilePath: (path, fileName) ->
    return path + '/' + fileName + '.json'

  @buildTempFilePath: (path, fileName) ->
    return path + '/' + fileName + '_temp.json'

  # ---
  # **loadFile**</br>
  # Loads existing file from the disk</br>
  # `params`
  #   *filePath* path to the file
  @loadFile: (filePath) ->
    try
      stats = fs.statSync(filePath)
      if stats.isFile()
        content = JSON.parse(fs.readFileSync(filePath,'utf8'))
        return content
      else
        return null
    catch error
      logger.log 'error', 'Could not read file: ' + filePath
      return null

  # ---
  # **/br>
  # saves the a file to disk</br>
  @saveFile: (filePath, content, callback) ->
    try
      fs.writeFileSync filePath, JSON.stringify(content, null, '\t')
      if callback?
        callback null
    catch error
      logger.log 'error', error
    return

  @saveFileBase64: (filePath, content, callback) ->
    try
      fs.writeFileSync filePath, JSON.stringify(content, null, '\t'), 'base64'
      if callback?
        callback null
    catch error
      logger.log 'error', error
    return

  @writeTempFile: (filePath) ->
    try
      fs.statSync filePath
    catch error
      try
        fs.writeFileSync filePath, JSON.stringify({status :'planned'})
      catch error
        logger.log 'error', error
    return

  @getStaticImageUrl: (folder, filename) ->
    rootUrl = nconf.get('server:rootUrl')
    outputUrl = 'http://' + rootUrl + '/images/' + folder + '/' + filename
    return outputUrl

  @getStaticDataUrl: (folder, filename) ->
    rootUrl = nconf.get('server:rootUrl')
    outputUrl = 'http://' + rootUrl + '/data/' + folder + '/' + filename
    return outputUrl

  @getStaticImageUrlWithExt: (folder, filename, extension) ->
    rootUrl = nconf.get('server:rootUrl')
    outputUrl = 'http://' + rootUrl + '/images/' + folder + '/' + filename + '.' + extension
    return outputUrl

  @getStaticDataUrlWithRelPath: (relativefilePath) ->
    rootUrl = nconf.get('server:rootUrl')
    return 'http://' + rootUrl + '/data/' + relativefilePath

  @getStaticImageUrlWithRelPath: (relativefilePath) ->
    rootUrl = nconf.get('server:rootUrl')
    return 'http://' + rootUrl + '/images/' + relativefilePath

  @getStaticDataUrlWithFullPath: (fullPath) ->
    relPath = fullPath.replace(nconf.get('paths:dataRootPath') + '/','')
    return @getStaticDataUrlWithRelPath(relPath)

  @getStaticImageUrlWithFullPath: (fullPath) ->
    relPath = fullPath.replace(nconf.get('paths:imageRootPath') + '/', '')
    return @getStaticImageUrlWithRelPath(relPath)

  @downloadFile: (fileUrl, localFolder, fileType, callback) ->
    @checkFileType(fileType,fileUrl, (error) ->
      if(error?)
        callback error
        return
      filename = path.basename(url.parse(fileUrl).pathname)
      #check headers first to ensure fileType is correct if available
      file = fs.createWriteStream(localFolder + path.sep + filename)
      switch(url.parse(fileUrl).protocol)
        when 'http:'
          http.get(fileUrl, (response) ->
            response.pipe(file)
            response.on('end', () ->
              callback null, localFolder + path.sep + filename
            )
          )
        when 'https:'
          https.get(fileUrl, (response) ->
            response.pipe(file)
            response.on('end', () ->
              callback null, localFolder + path.sep + filename
            )
          )
    )


  @checkFileType: (fileType, fileUrl, callback) ->
    if(fileType?)
      urlInfo = url.parse(fileUrl)
      options = {method: 'HEAD', hostname: urlInfo.hostname, path: urlInfo.path, port: urlInfo.port }
      req = http.request(options, (res) ->
        if(res.headers['content-type'] isnt fileType)
          callback {error: 'non matching fileType'}
        else
          callback null
      )
      req.end()
    else
      callback null


  @createDataCollectionFolders: (service) ->
    rootFolder = nconf.get('paths:dataRootPath') + path.sep + service.service
    mkdirp(rootFolder, (err) ->
      if(err)
        logger.log 'error', err
    )
    mkdirp(rootFolder + path.sep + 'original', (err) ->
      if(err)
        logger.log 'error', err
    )

  @createImageCollectionFolders: (collection) ->
    rootFolder = nconf.get('paths:imageRootPath') + path.sep + collection
    mkdirp(rootFolder, (err) ->
      if(err)
        logger.log 'error', err
    )
    mkdirp(rootFolder + path.sep + 'original', (err) ->
      if(err)
        logger.log 'error', err
    )

  @deleteImageCollectionFolders: (collection) ->
    rootFolder = nconf.get('paths:imageRootPath') + path.sep + collection
    rmdir(rootFolder, (err) ->
      if(err)
        logger.log 'error', err
        return
      return
    )
    
  @checkFileExists: (filePath) ->
    try
      stats = fs.statSync(filePath)
      return stats.isFile()
    catch error
      return false

  @readdir: (path) ->
    try
      files = fs.readdirSync(path)
      return files
    catch error
      return null