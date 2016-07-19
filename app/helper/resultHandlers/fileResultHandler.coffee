# FileResultHandler
# =======
#
# **FileResultHandler** handles results coming from a file

_           = require 'lodash'
fs          = require 'fs'
logger      = require '../../logging/logger'
ImageHelper = require '../imageHelper'
IoHelper    = require '../ioHelper'

fileResultHandler = exports = module.exports = class FileResultHandler
  @filename: ''
  constructor: (filepath) ->
    @filename = filepath
  handleResult: (error, stdout, stderr, process, callback) ->
    self = @
    fs.stat @filename, (err, stat) ->
      #check if file exists
      if !err?
        fs.readFile self.filename, 'utf8', (err, data) ->
          if err?
            error=
              statusCode: 500
              statusMessage: 'Could not read result file'
            callback error, null, null
          else
            try
              data = JSON.parse(data)
              files = _.filter(data.output, (entry) ->
                return _.has(entry,'file')
              )
              for entry in files

                IoHelper.saveFileBase64(process.outputFolder + '/' + entry.file.filename, entry.file.content, () ->
                  entry.file['url'] = IoHelper.getStaticFileUrl(process.rootFolder + '/' + process.methodFolder, entry.file.filename)
                  delete entry.file.filename
                  delete entry.file.content
                )

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
              fs.writeFileSync(self.filename,JSON.stringify(data), "utf8")
            catch error
              err =
                statusCode: 500
                statusMessage: 'Could not parse result'
              callback err
              logger.log 'error', error
            callback null, data, process.id
      else
        callback err, null, null
