logger  = require '../logging/logger'
fs      = require 'fs'
path    = require 'path'
sequest = require 'sequest'

remoteExecution = exports = module.exports = class RemoteExecution

  constructor: (serverUrl, user) ->
    @serverUrl = serverUrl
    @userName = user
    @sequest = sequest @userName + '@' + @serverUrl


  uploadFile: (localFile) ->
    extension = path.extname(localFile)
    filename = path.basename(localFile,extension)
    writer = sequest.put(@userName + '@' + @serverUrl, '/home/wuerschm/' + filename + extension)
    fs.createReadStream(localFile).pipe(writer)
    writer.on('close',() ->
      console.log 'finished writing'
    )

  executeJob: () ->
    @sequest.write('./job.sh')

