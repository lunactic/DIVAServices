path            = require 'path'
ParameterHelper = require './parameterHelper'
IoHelper        = require './ioHelper'

resultHelper = exports = module.exports = class ResultHelper

  @parameterHelper = new ParameterHelper()
  @ioHelper = new IoHelper()


  @checkCollectionResultAvailable: (collection) ->
    collection.rootFolder = collection.name
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

