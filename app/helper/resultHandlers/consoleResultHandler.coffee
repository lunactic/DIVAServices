# ConsoleResultHandler
# =======
#
# **ConsoleResultHandler** handles results coming from the console
fs = require 'fs'
logger = require '../../logging/logger'
ImageHelper = require '../imageHelper'

class ConsoleResultHandler
  @file = ""
  constructor: (filePath) ->
    @file = filePath

  handleError: (error, process) ->
    self = @
    fs.stat @filename, (err, stat) ->
      data =
        status: 'done'
        resultLink: process.resultLink
        collectionName: process.rootFolder
        statusMessage: error
        statusCode: 500
      fs.writeFileSync(self.filename,JSON.stringify(data), "utf8")

  handleResult: (error, stdout, stderr, process, callback) ->
    self = @
    if stderr.length > 0
      err =
        statusText: stderr
        status: 500
      callback err, null, process.id
    else
      fs.stat self.file, (err, stat) ->
        if !err?
          fs.readFile self.file, 'utf8', (err, data) ->
            if err?
              callback err, null, null
            else
              try
                data = JSON.parse(data)
                data['status'] = 'done'
                if(data['image']?)
                  ImageHelper.saveImageJson(data['image'],process)
                  process.outputImageUrl = ImageHelper.getOutputImageUrl(process.rootFolder + '/' + process.methodFolder, process.image.name, process.image.extension )
                  data['outputImage'] = process.outputImageUrl
                  delete data['image']

                data['inputImage'] = process.inputImageUrl
                data['resultLink'] = process.resultLink
                data['collectionName'] = process.rootFolder
                data['resultZipLink'] = 'http://192.168.56.101:8080/collections/' + process.rootFolder + '/' + process.methodFolder
                fs.writeFileSync(self.file,JSON.stringify(data), "utf8")
              catch error
                logger.log 'error', error
              callback null, data, process.id
        else
          callback err, null, null

module.exports = ConsoleResultHandler
