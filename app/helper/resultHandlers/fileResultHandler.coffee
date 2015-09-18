# FileResultHandler
# =======
#
# **FileResultHandler** handles results coming from a file

fs = require 'fs'

consoleResultHandler = exports = module.exports = class consoleResultHandler
  @filename: ''
  constructor: (filepath) ->
    @filename = filepath
  handleResult: (error, stdout, stderr, statIdentifier, callback) ->
    self = @
    fs.stat @filename, (err, stat) ->
      #check if file exists
      console.log err
      if !err?
        fs.readFile self.filename, 'utf8', (err, data) ->
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
