# ConsoleResultHandler
# =======
#
# **ConsoleResultHandler** handles results coming from the console

consoleResultHandler = exports = module.exports = class consoleResultHandler
  @file = ""
  constructor: (filePath) ->
    @file = filePath
  handleResult: (error, stdout, stderr, statIdentifier, callback) ->
    if stderr.length > 0
      err =
        statusText: stderr
        status: 500
      callback err, null, statIdentifier
    else
      fs.stat @file, (err, stat) ->
        if !err?
          fs.readFile @file, 'utf8', (err, data) ->
            if err?
              callback err, null, null
            else
              callback null, data, statIdentifier
        else
          callback err, null, null
