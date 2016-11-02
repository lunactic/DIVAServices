logger = require '../logging/logger'
fs = require 'fs'
path = require 'path'
sequest = require 'sequest'

class RemoteExecution

  constructor: (serverUrl, user) ->
    @serverUrl = serverUrl
    @userName = user


  uploadFile: (localFile, remoteFolder, callback) ->
    seq = sequest.connect(@userName + '@' + @serverUrl, {readyTimeout: 99999})
    seq 'mkdir -p ' + remoteFolder, (e, stdout) ->
      extension = path.extname(localFile)
      filename = path.basename(localFile, extension)
      writer = seq.put(remoteFolder + '/' + filename + extension)
      fs.createReadStream(localFile).pipe(writer)
      writer.on('close', () ->
        callback null
        return
      )

  executeCommand: (command, callback) ->
    seq = sequest.connect(@userName + '@' + @serverUrl, {readyTimeout: 99999})
    seq command
    callback null

  cleanUp: (process) ->
    seq = sequest.connect(@userName + '@' + @serverUrl, {readyTimeout: 99999})
    seq 'rm -rf ' + process.rootFolder + '/'

module.exports = RemoteExecution