# FileResultHandler
# =======
#
# **FileResultHandler** handles results coming from a file

_           = require 'lodash'
fs          = require 'fs'
logger      = require '../../logging/logger'
nconf       = require 'nconf'
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
              if process.executableType is 'matlab'
                #get the current outputContent
                tmpOutput = data.output
                #push all objects into the output array
                data.output = [ ]
                _.forIn(tmpOutput, (value, key) ->
                  newKey = key.replace(/\d/g,'')
                  newObject = {}
                  if value.hasOwnProperty('mimetype')
                    value['mime-type'] = value.mimetype
                    delete value.mimetype

                  newObject[newKey] = value
                  data.output.push(newObject)
                )
                #create the output array

              #get 'files' from the output array
              files = _.filter(data.output, (entry) ->
                return _.has(entry,'file')
              )
              visualization = false
              for file in files
                if file.file['mime-type'].startsWith('image')
                  ImageHelper.saveImageJson(file.file.content, process)
                  process.outputImageUrl = ImageHelper.getOutputImageUrl(process.rootFolder + '/' + process.methodFolder, process.image.name, process.image.extension )
                  file.file['url'] = process.outputImageUrl
                  if file.file.options.visualization
                    visualization = true

                  delete file.file.content
                else
                  IoHelper.saveFileBase64(process.outputFolder + '/' + file.file.filename, file.file.content, () ->
                    if process.hasImages
                      file.file['url'] = IoHelper.getStaticImageUrl(process.rootFolder + '/' + process.methodFolder, file.file.filename)
                    else if process.hasFiles
                      file.file['url'] = IoHelper.getStaticDataUrl(process.rootFolder + '/' + process.methodFolder, file.file.filename)
                    delete file.file.content
                  )

              #check if there is a visualization type, otherwise generate one of the original inputImage
              if not visualization and process.inputImageUrl?
                file =
                  file:
                    'mime-type': 'png'
                    url: process.inputImageUrl
                    name: 'visualization'
                    options:
                      visualization: true
                      type: 'outputVisualization'
                data.output.push(file)

              data['status'] = 'done'
              data['inputImage'] = process.inputImageUrl
              data['resultLink'] = process.resultLink
              data['collectionName'] = process.rootFolder
              data['resultZipLink'] = 'http://' + nconf.get('server:rootUrl') + '/collections/' + process.rootFolder + '/' + process.methodFolder
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
