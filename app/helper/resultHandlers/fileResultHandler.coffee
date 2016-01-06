# FileResultHandler
# =======
#
# **FileResultHandler** handles results coming from a file

fs = require 'fs'
logger = require '../../logging/logger'
ImageHelper = require '../imageHelper'

consoleResultHandler = exports = module.exports = class consoleResultHandler
  @filename: ''
  constructor: (filepath) ->
    @filename = filepath
  handleResult: (error, stdout, stderr, statIdentifier,process, callback) ->
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
              if(!data)
                data['status'] = 'done'
              if(data['image']?)
                ImageHelper.saveImageJson(data['image'],process)
                data['outputImage'] = process.outputImageUrl
              data['inputImage'] = process.inputImageUrl
              data['resultLink'] = process.resultLink
              data['collectionName'] = process.rootFolder
              fs.writeFileSync(self.filename,JSON.stringify(data), "utf8")
            catch error
              console.log error
            callback null, data, statIdentifier
      else
        callback err, null, null
