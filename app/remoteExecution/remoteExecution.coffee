logger  = require '../logging/logger'
fs      = require 'fs'
path    = require 'path'
sequest = require 'sequest'

remoteExecution = exports = module.exports = class RemoteExecution

  constructor: (serverUrl, user) ->
    @serverUrl = serverUrl
    @userName = user
    @sequest = sequest @userName + '@' + @serverUrl
    @sequest.pipe(process.stdout)


  uploadFile: (localFile, remoteFolder, callback) ->
    @sequest.write('mkdir -p ' + remoteFolder)
    extension = path.extname(localFile)
    filename = path.basename(localFile,extension)
    writer = sequest.put(@userName + '@' + @serverUrl, remoteFolder + '/' + filename + extension)
    fs.createReadStream(localFile).pipe(writer)
    writer.on('close',() ->
      logger.log 'info', 'remote file written'
      callback null
    )

  executeCommand: (command, callback) ->
    logger.log 'info', 'running remote command: ' + command
    @sequest.write(command)
    callback null

  cleanUp: (process) ->
    @sequest.write('rm -rf ' + process.rootFolder + '/')
