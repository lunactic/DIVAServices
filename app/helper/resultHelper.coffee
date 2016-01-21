_               = require 'lodash'
path            = require 'path'
ParameterHelper = require './parameterHelper'
IoHelper        = require './ioHelper'

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

  @saveResult: (info) ->
    @ioHelper.saveFile(info.resultFile, info.result)

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
