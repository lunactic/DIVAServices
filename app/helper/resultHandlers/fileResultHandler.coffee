# FileResultHandler
# =======
#
# **FileResultHandler** handles results coming from a file

fs = require 'fs'

consoleResultHandler = exports = module.exports = class consoleResultHandler
  filename: ''
  constructor: (filepath) ->
    filename = filepath
  handleResult: (error, stdout, stderr, statIdentifier, callback) ->
    fs.stat filename, (err, stat) ->
      #check if file exists
      console.log err
      if !err?
        fs.readFile filename, 'utf8', (err, data) ->
          if err?
            callback err, null, null, null
          else
            callback null, data, statIdentifier, false
      else
        callback err, null, null, null
