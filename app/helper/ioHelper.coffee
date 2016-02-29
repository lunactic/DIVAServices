# IoHelper
# =======
#
# **IoHelper** provides helper methods for handling with files
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependecies
archiver = require 'archiver'
fs      = require 'fs'
nconf   = require 'nconf'
path    = require 'path'
_       = require 'lodash'
logger  = require '../logging/logger'


# expose IoHelper
ioHelper = exports = module.exports = class IoHelper

  zipFolder: (folder) ->
    #zip folder
    #save zip this way: /data/images/:collection/:execution.zip
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
      src: ['*']
    ])
    archive.finalize()
    return fileName

  getOutputFolder: (rootFolder, service) ->
    #check which folder is to be used
    imagePath = nconf.get('paths:imageRootPath')
    rootPath = imagePath + '/' + rootFolder
    #read all folders in the current directory
    folders = fs.readdirSync(rootPath).filter (file) ->
      fs.statSync(path.join(rootPath,file)).isDirectory()

    #filter for folders matching the service name
    folders = _.filter folders,  (folder) ->
      _.includes folder,service


    if(folders.length > 0)
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
  saveFile: (filePath, content) ->
    fs.stat filePath, (err, stat) ->
      fs.writeFile filePath, JSON.stringify(content),  (err) ->
        if err?
          logger.log 'error', err

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