# ConsoleResultHandler
# =======
#
# **ConsoleResultHandler** handles results coming from the console
fs = require 'fs'


consoleResultHandler = exports = module.exports = class consoleResultHandler
  @file = ""
  constructor: (filePath) ->
    @file = filePath
 
  handleResult: (error, stdout, stderr, statIdentifier, callback) ->
    #if a file is given
    console.log 'file: ' + @file
    if(@file?)
      self = @
      if stderr.length > 0
        err =
          statusText: stderr
          status: 500
        callback err, null, statIdentifier
      else
        fs.stat self.file, (err, stat) ->
          if !err?
            fs.readFile self.file, 'utf8', (err, data) ->
              if err?
                callback err, null, null
              else
                try
                  data = JSON.parse(data)
                  if(!data.status)
                    data['status'] ='done'
                catch error
                  console.log error
                callback null, data, statIdentifier
          else
            callback err, null, null
    else
      if stderr.length > 0
        err =
          statusText: stderr
          status: 500
        callback err, null, statIdentifier, false
      else
        #console.log 'task finished. Result: ' + stdout
        callback null, stdout, statIdentifier, false
