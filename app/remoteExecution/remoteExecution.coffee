logger  = require '../logging/logger'
fs      = require 'fs'
path    = require 'path'
sequest = require 'sequest'

remoteExecution = exports = module.exports = class RemoteExecution

  constructor: (serverUrl, user) ->
    @serverUrl = serverUrl
    @userName = user


  uploadFile: (localFile, remoteFolder, callback) ->
    #TODO ADD TRY CATCH / RETRY?
    try
      seq = sequest(@userName + '@' + @serverUrl,{readyTimeout: 99999})
      seq.write('mkdir -p ' + remoteFolder)
      extension = path.extname(localFile)
      filename = path.basename(localFile,extension)
      writer = sequest.put(@userName + '@' + @serverUrl, remoteFolder + '/' + filename + extension)
      fs.createReadStream(localFile).pipe(writer)
      writer.on('close',() ->
        logger.log 'info', 'remote file written'
        callback null
      )
    catch error
      logger.log('error', error, 'remoteExecution:uploadFile')

  executeCommand: (command, callback) ->
    try
      seq = sequest(@userName + '@' + @serverUrl,{readyTimeout: 99999})
      logger.log 'info', 'running remote command: ' + command
      seq.write(command)
      callback null
    catch error
      logger.log('error', error, 'remoteExecution:executeCommand')

  cleanUp: (process) ->
    @sequest.write('rm -rf ' + process.rootFolder + '/')
