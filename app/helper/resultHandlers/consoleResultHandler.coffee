# ConsoleResultHandler
# =======
#
# **ConsoleResultHandler** handles results coming from the console

consoleResultHandler = exports = module.exports = class consoleResultHandler
  constructor: ->

  handleResult: (error, stdout, stderr, statIdentifier, callback) ->
    if stderr.length > 0
      err =
        statusText: stderr
        status: 500
      callback err, null, statIdentifier, false
    else
      #console.log 'task finished. Result: ' + stdout
      callback null, stdout, statIdentifier, false
