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

              # parse the result into json
              data = JSON.parse(data)

              #get 'files' from the output array
              files = _.filter(data.output, (entry) ->
                return _.has(entry,'file')
              )
              for file in files
                IoHelper.saveFileBase64(process.outputFolder + '/' + file.file.filename, file.file.content, () ->
                  file.file['url'] = IoHelper.getStaticFileUrl(process.rootFolder + '/' + process.methodFolder, file.file.filename)
                  delete file.file.filename
                  delete file.file.content
                )

              #get 'images' from the output array
              images = _.filter(data.output, (entry) ->
                return _.has(entry, 'image')
              )
              for image in images
                ImageHelper.saveImageJson(image.image.content,process)
                process.outputImageUrl = ImageHelper.getOutputImageUrl(process.rootFolder + '/' + process.methodFolder, process.image.name, process.image.extension )
                image.image['url'] = process.outputImageUrl
                delete image.image['content']

              data['status'] = 'done'
              data['inputImage'] = process.inputImageUrl
              data['resultLink'] = process.resultLink
              data['collectionName'] = process.rootFolder

              #TODO Fix this link
              #data['resultZipLink'] = 'http://192.168.56.101:8080/collections/' + process.rootFolder + '/' + process.methodFolder
              fs.writeFileSync(self.filename,JSON.stringify(data), "utf8")
            catch error
              logger.log 'error', error
              err =
                statusCode: 500
                statusMessage: 'Could not parse result'
              callback err
            callback null, data, process.id
      else
        callback err, null, null
