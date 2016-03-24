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
unzip     = require 'unzip2'
url       = require 'url'
logger    = require '../logging/logger'


# expose IoHelper
ioHelper = exports = module.exports = class IoHelper

  deleteFile: (file) ->
    fs.unlink(file)

  unzipFolder: (zipFile, folder, callback) ->
    mkdirp(folder, (err) ->
      if(err)
        logger.log 'error', err
        callback err
      else
        reader = fs.createReadStream(zipFile)
        reader.pipe(unzip.Extract({path: folder})).on 'close', ->
          callback null
    )

  zipFolder: (folder) ->
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
      src: ['*','**/*']
    ])
    archive.finalize()
    return fileName

  getOutputFolder: (rootFolder, service, unique) ->
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
      maxNumber = parseInt(_.max(numbers),10)
      return rootPath + '/' + service + '_' + (maxNumber + 1)
    else
      return rootPath + '/' + service + '_0'

  #build file Path from outputFolder name and filename
  buildFilePath: (path, fileName) ->
    return path + '/' + fileName + '.json'

  buildTempFilePath: (path, fileName) ->
    return path + '/' + fileName + '_temp.json'

  # ---
  # **loadFile**</br>
  # Loads existing file from the disk</br>
  # `params`
  #   *filePath* path to the file
  loadFile: (filePath) ->
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
  saveFile: (filePath, content, callback) ->
    try
      fs.writeFileSync filePath, JSON.stringify(content, null, '\t')
      if callback?
        callback null
    catch error
      logger.log 'error', error
    return
  writeTempFile: (filePath) ->
    try
      stats = fs.statSync filePath
        #check if file exists
        #console.log 'saving file to: ' + filePath
    catch error
      try
        fs.writeFileSync filePath, JSON.stringify({status :'planned'})
      catch error
        logger.log 'error', error

    return

  downloadFile: (fileUrl, localFolder, callback) ->
    filename = path.basename(url.parse(fileUrl).pathname)
    file = fs.createWriteStream(localFolder + path.sep + filename)
    switch(url.parse(fileUrl).protocol)
      when 'http:'
        request = http.get(fileUrl, (response) ->
          response.pipe(file)
          response.on('end', () ->
            callback null, localFolder + path.sep + filename
          )
        )
      when 'https:'
        request = https.get(fileUrl, (response) ->
          response.pipe(file)
          response.on('end', () ->
            callback null, localFolder + path.sep + filename
          )
        )

    
  createCollectionFolders: (collection) ->
    rootFolder = nconf.get('paths:imageRootPath') + path.sep + collection
    mkdirp(rootFolder, (err) ->
      if(err)
        logger.log 'error', err
    )
    mkdirp(rootFolder + path.sep + 'original', (err) ->
      if(err)
        logger.log 'error', err
    )
  deleteCollectionFolders: (collection) ->
    rootFolder = nconf.get('paths:imageRootPath') + path.sep + collection
    fs.stat(rootFolder + path.sep + 'original', (err, stat) ->
      if(!err?)
        fs.rmdirSync(rootFolder + path.sep + 'original')
    )
    fs.stat(rootFolder, (err,stat) ->
      if(!err?)
        fs.rmdirSync(rootFolder)
    )
    return
    
  checkFileExists: (filePath) ->
    try
      stats = fs.statSync(filePath)
      return stats.isFile()
    catch error
      return false

  readdir: (path) ->
    try
      files = fs.readdirSync(path)
      return files
    catch error
      return null