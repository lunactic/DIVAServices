# ConsoleResultHandler
# =======
#
# **ConsoleResultHandler** handles results coming from the console
fs = require 'fs'


consoleResultHandler = exports = module.exports = class consoleResultHandler
  @file = ""
  constructor: (filePath) ->
    @file = filePath

  handleResultGabor: (error, stdout, stderr, statIdentifier, callback) ->
    if stderr.length > 0
      err =
        statusText: stderr
        status: 500
      callback err, null, statIdentifier
    else
      #console.log 'task finished. Result: ' + stdout
      callback null, stdout, statIdentifier

  handleResult: (error, stdout, stderr, statIdentifier, process, callback) ->
    if(!file?)
      @handleResultGabor(error,stdout,stderr,statIdentifier,callback)

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
                if(!data['status'])
                  data['status'] = 'done'
                data['inputImage'] = process.inputImageUrl
                data['resultLink'] = process.resultLink
                if(process.outputImageUrl?)
                  data['outputImage'] = process.outputImageUrl
                fs.writeFileSync(self.file,JSON.stringify(data), "utf8")
              catch error
                console.log error
              callback null, data, statIdentifier
        else
          callback err, null, null
