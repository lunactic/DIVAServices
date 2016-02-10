logger  = require '../logging/logger'
fs      = require 'fs'
sequest = require 'sequest'

remoteExecution = exports = module.exports = class RemoteExecution

  constructor: (serverUrl, user) ->
    @serverUrl = serverUrl
    @userName = user
    @sequest = sequest @userName + '@' + @serverUrl

  sshAuth: () ->
    @sequest.pipe(process.stdout)
    @sequest.write('uptime')


  uploadFile: (localFile) ->
    writer = sequest.put(@userName + '@' + @serverUrl, '/home/wuerschm/test.png')
    fs.createReadStream(localFile).pipe(writer)
    writer.on('close',() ->
      console.log 'finished writing'
    )

