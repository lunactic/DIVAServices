# FileResultHandler
# =======
#
# **FileResultHandler** handles results coming from a file

fs = require 'fs'
logger = require '../../logging/logger'

consoleResultHandler = exports = module.exports = class consoleResultHandler
  @filename: ''
  constructor: (filepath) ->
    @filename = filepath
  handleResult: (error, stdout, stderr, statIdentifier,process, callback) ->
    self = @
    fs.stat @filename, (err, stat) ->
      #check if file exists
      if !err?
        fs.readFile self.filename, 'utf8', (err, data) ->
          if err?
            callback err, null, null
          else
            try
              data = JSON.parse(data)
              if(!data)
                data['status'] = 'done'
              data['inputImage'] = process.inputImageUrl
              data['resultLink'] = process.resultLink
              if(process.outputImageUrl?)
                data['outputImage'] = process.outputImageUrl
              fs.writeFileSync(self.filename,JSON.stringify(data), "utf8")
            catch error
              logger.log 'error', error
            callback null, data, statIdentifier
      else
        callback err, null, null
