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

  @loadAvailableResults: (folder) ->
    files = @ioHelper.readdir(folder)
    if(files?)
      files = _.filter(files, (file) ->
        return file.endsWith('.json')
      )
      for file in files
        content = @ioHelper.loadFile(folder + path.sep + file)
        parameters = content.parameters


