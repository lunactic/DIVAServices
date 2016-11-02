# ParameterHelper
# =======
#
# **ParameterHelper** Provides access to different parameter matching helper methodl
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependencies
_           = require 'lodash'
fs          = require 'fs'
nconf       = require 'nconf'
hash        = require 'object-hash'
path        = require 'path'
util        = require 'util'
logger      = require '../logging/logger'
ImageHelper = require './imageHelper'
IoHelper    = require './ioHelper'

# expose parameterHelper
class ParameterHelper

  # ---
  # **getParamValue**</br>
  # Gets the value of an input parameter</br>
  # `params`
  #   *parameter* the parameter to get the value for
  #   *inputParameters* the list of input parameters with all its values
  getParamValue: (parameter, inputParameters) ->
    if inputParameters.hasOwnProperty(parameter)
      return inputParameters[parameter]
    return

 # ---
  # **getReservedParamValue**</br>
  # Gets the value of a reserved parameter as defined in conf/server.NODE_ENV.json</br>
  # `params`
  #   *parameter* reserved parameter
  #   *neededParameters* the required parameters
  #   *imagePath* path to the input image
  #   *md5* md5 hash of the input image
  #   *req* the request
  getReservedParamValue: (parameter, process, req) ->

    switch parameter
      when 'matlabPath'
        return nconf.get('paths:matlabPath')
      when 'matlabScriptsPath'
        return nconf.get('paths:matlabScriptsPath')
      when 'inputFileExtension'
        return path.extname(process.image.path).slice(1)
      when 'inputFolder'
        return process.inputFolder
      when 'inputImage'
        return process.image.path
      when 'inputImageUrl'
        imageHelper = new ImageHelper()
        return imageHelper.getInputImageUrl(process.image.md5)
      when 'imageRootPath'
        return nconf.get('paths:imageRootPath')
      when 'outputFolder'
        return process.outputFolder
      when 'host'
        return nconf.get('server:rootUrl')
      when 'ocropyLanguageModelsPath'
        return nconf.get('paths:ocropyLanguageModelsPath')
      when 'startUp'
        return process.neededParameters['startUp']
      when 'outputImage'
        return '##outputImage##'
      when 'noisingXmlFile'
        return nconf.get('paths:noisingXmlPath')
      when 'mcr2014b'
        return nconf.get('paths:mcr2014b')
  # ---
  # **matchParams**</br>
  # Matches the received parameter values to the needed parameters</br>
  # `params`
  #   *process* the process information
  #   *req* incoming request
  matchParams: (process, req) ->
    params = {}
    outputParams = {}

    for neededParameter in process.neededParameters
      #build parameters
      paramKey = _.keys(neededParameter)[0]
      paramValue = neededParameter[paramKey]

      if checkReservedParameters paramKey
        #check if highlighter
        if paramKey is 'highlighter'
          params[paramKey] = this.getHighlighterParamValues(process.inputHighlighters.type, process.inputHighlighters.segments)
        else
          params[paramKey] = this.getReservedParamValue(paramKey, process, req)
      else
        #handle json
        value = this.getParamValue(paramKey, process.inputParameters)
        if value?
          if paramValue is 'json'
            jsonFile = process.outputFolder + '/jsonInput.json'
            IoHelper.saveFile(jsonFile, value, () ->)
            params[paramKey] = jsonFile
            outputParams[paramKey] = jsonFile
          else
            params[paramKey] = value
            outputParams[paramKey] = value
        else if paramValue is 'url'
          params[paramKey] = ""
          outputParams[paramKey] = ""
    result =
      params: params
      outputParams: outputParams
    return result

  buildGetUrl: (process) ->
    if process.hasImages
      return IoHelper.getStaticImageUrlWithFullPath(process.resultFile)
    else
      return IoHelper.getStaticDataUrlWithFullPath(process.resultFile)

  buildGetUrlCollection: (collection) ->
    #get the first process for parameter information
    if collection.hasImages
      return IoHelper.getStaticImageUrlWithFullPath(collection.resultFile)
    else
      return IoHelper.getStaticDataUrlWithFullPath(collection.resultFile)



  # ---
  # **getHighlighterParamValues**</br>
  # Gets Parameter values for highlighters.
  # The values will be as follow:
  #  for 'rectangle':
  #    topLeft.x topLeft.y topRight.x topRight.y bottomRight.x bottomRight.y bottomLeft.x bottomRight.y
  #  for 'circle':
  #    position.x position.y radius
  #  for 'polygon'
  #    point1.x point1.y point2.x point2.y, ..., pointN.x, pointN.y</br>
  # `params`
  #   *neededHighlighter* required highlighter as defined by the method
  #   *inputHighlighter*  received highlighter with its value from the request
  getHighlighterParamValues: (neededHighlighter, inputHighlighter) ->
    switch neededHighlighter
      when 'rectangle'
        merged = []
        merged = merged.concat.apply(merged,inputHighlighter)
        merged = merged.map(Math.round)
        return merged.join(' ')
      when 'circle'
        position = inputHighlighter.position
        position = position.map(Math.round)
        radius = inputHighlighter.radius
        radius = Math.round(radius)
        return position[0] + ' ' + position[1] + ' ' + radius
      when 'polygon'
        merged = []
        merged = merged.concat.apply(merged, inputHighlighter)
        merged = merged.map(Math.round)
        return merged.join(' ')


  getMethodName: (algorithm) ->
    return algorithm.replace(/\//g, '')

  createOutputFolder: (outputFolder) ->
    try
      fs.mkdirSync(outputFolder)
    catch error

    return

  saveParamInfo: (process, parameters, rootFolder,outputFolder,method ) ->
    if process.result?
      return

    if process.hasImages
      methodPath = nconf.get('paths:imageRootPath') + '/'+ rootFolder + '/' + method + '.json'
    else if process.hasFiles
      methodPath = nconf.get('paths:dataRootPath') + '/' + rootFolder + '/' + method + '.json'
    else
      methodPath = nconf.get('paths:dataRootPath') + '/' + rootFolder + '/' + method + '.json'

    content = []
    if(process.inputHighlighters?)
      data =
        highlighters: _.clone(process.inputHighlighters)
        parameters: hash(process.inputParameters)
        folder: outputFolder
    else
      data =
        highlighters: {}
        parameters: hash(process.inputParameters)
        folder: outputFolder

    #make strings of everything
    _.forIn(data.highlighters, (value,key) ->
      data.highlighters[key] = String(value)
    )
    logger.log 'info', 'saveParamInfo'
    logger.log 'info', JSON.stringify process.inputParameters
    logger.log 'info', 'hash: ' + hash(process.inputParameters)

    try
      fs.statSync(methodPath).isFile()
      content = JSON.parse(fs.readFileSync(methodPath,'utf8'))
      #only save the information if its not already present
      if(_.filter(content,{'parameters':data.parameters, 'highlighters':data.highlighters}).length == 0)
        content.push data
        fs.writeFileSync(methodPath, JSON.stringify(content))
    catch error
      content.push data
      fs.writeFileSync(methodPath, JSON.stringify(content))

  loadParamInfo: (process) ->
    if process.hasImages
      paramPath = nconf.get('paths:imageRootPath') + '/' + process.rootFolder + '/' + process.method + '.json'
    else
      paramPath = nconf.get('paths:dataRootPath') + '/' + process.rootFolder + '/' + process.method + '.json'

    data =
      highlighters: process.inputHighlighters
      parameters: hash(process.inputParameters)
    try
      fs.statSync(paramPath).isFile()
      content = JSON.parse(fs.readFileSync(paramPath,'utf8'))
      if((info = _.filter(content,{'parameters':data.parameters, 'highlighters':data.highlighters})).length > 0)
        #found some information about this method
        if process.hasImages
          if(process.image?)
            process.resultFile = IoHelper.buildFilePath(info[0].folder, process.image.name)
          else
            process.resultFile = IoHelper.buildFilePath(info[0].folder, path.basename(info[0].folder))
        else
          process.resultFile = IoHelper.buildFilePath(info[0].folder, path.basename(info[0].folder))
        process.outputFolder = info[0].folder
      else
        #found no information about that method
        return
    catch error
      #no information found
      return

  removeParamInfo: (process) ->
    paramPath = nconf.get('paths:imageRootPath') + '/' + process.rootFolder + '/' + process.method + '.json'
    data =
      highlighters: process.inputHighlighters
      parameters: process.inputParameters
    try
      fs.statSync(paramPath).isFile()
      content = JSON.parse(fs.readFileSync(paramPath,'utf8'))
      if((info = _.filter(content,{'parameters':data.parameters, 'highlighters':data.highlighters})).length > 0)
        _.remove(content, {'parameters':data.parameters, 'highlighters':data.highlighters})
        fs.writeFileSync(paramPath, JSON.stringify(content))



# ---
  # **checkReservedParameters**</br>
  # Checks if a parameter is in the list of reserverd words as defined in server.NODE_ENV.json</br>
  # `params`
  #   *parameter* the parameter to check
  checkReservedParameters = (parameter) ->
    reservedParameters = nconf.get('reservedWords')
    return parameter in reservedParameters

module.exports = ParameterHelper


