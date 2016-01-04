# ConsoleResultHandler
# =======
#
# **ConsoleResultHandler** handles results coming from the console
fs = require 'fs'
logger = require '../../logging/logger'
ImageHelper = require '../imageHelper'
consoleResultHandler = exports = module.exports = class consoleResultHandler
  @file = ""
  constructor: (filePath) ->
    @file = filePath

  handleResult: (error, stdout, stderr, statIdentifier,process, callback) ->
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
                ImageHelper.saveImageJson(data['image'],process)
                data['inputImage'] = process.inputImageUrl
                data['resultLink'] = process.resultLink
                data['outputImage'] = process.outputImageUrl
                data['collectionName'] = process.rootFolder
                fs.writeFileSync(self.file,JSON.stringify(data), "utf8")
              catch error
                logger.log 'error', error
              callback null, data, statIdentifier
        else
          callback err, null, null
