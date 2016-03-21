_               = require 'lodash'
path            = require 'path'
ImageHelper     = require './imageHelper'
IoHelper        = require './ioHelper'
ParameterHelper = require './parameterHelper'


resultHelper = exports = module.exports = class ResultHelper

  @parameterHelper = new ParameterHelper()
  @ioHelper = new IoHelper()

  @checkCollectionResultAvailable: (collection) ->
    collection.rootFolder = collection.name
    #make strings of everything
    _.forIn(collection.inputParameters, (value,key) ->
      collection.inputParameters[key] = String(value)
    )
    _.forIn(collection.inputHighlighters, (value,key) ->
      collection.inputHighlighters[key] = String(value)
    )


    @parameterHelper.loadParamInfo(collection)
    collection.resultFile = collection.outputFolder + path.sep + 'result.json'
    return @ioHelper.checkFileExists(collection.resultFile)

  @checkProcessResultAvailable: (process) ->
    @parameterHelper.loadParamInfo(process)
    return process.resultFile? and @ioHelper.checkFileExists(process.resultFile)

  @loadResult: (info) ->
    return @ioHelper.loadFile(info.resultFile)

  @saveResult: (info, callback) ->
    @ioHelper.saveFile(info.resultFile, info.result, callback)

  @loadAvailableResults: (folder, image) ->
    files = @ioHelper.readdir(folder)
    results = []
    if(files?)
      files = _.filter(files, (file) ->
        return file.endsWith('.json')
      )
      for file in files
        methodResults = @ioHelper.loadFile(folder + path.sep + file)
        for methodResult in methodResults
          processResult = @ioHelper.loadFile(methodResult.folder + path.sep + image.name + '.json')
          processResult['method'] = file.split('.')[0]
          processResult['parameters'] = methodResult.parameters
          results.push(processResult)
    return results

  @loadResultsForMd5: (md5) ->
    images = ImageHelper.loadImagesMd5(md5)
    response = []
    for image in images
      availableResults = @loadAvailableResults(image.rootFolder, image)
      for result in availableResults
        message =
          resultLink: result.resultLink
          method: result.method
          collectionName: result.collectionName
          parameters: result.parameters
        response.push message

    response['status'] = 'done'
    return response