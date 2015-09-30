# ParameterHelper
# =======
#
# **ParameterHelper** Provides access to different parameter matching helper methodl
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependencies
nconf   = require 'nconf'
path    = require 'path'

# expose parameterHelper
parameterHelper = exports = module.exports = class ParameterHelper


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
  #   *imagePath* path to the input image
  getReservedParamValue: (parameter, neededParameters, imagePath, req) ->
    switch parameter
      when 'matlabPath'
        return nconf.get('paths:matlabPath')
      when 'matlabScriptsPath'
        return nconf.get('paths:matlabScriptsPath')
      when 'inputFileExtension'
        return path.extname(imagePath).slice(1)
      when 'image'
        return imagePath
      when 'imageRootPath'
        return nconf.get('paths:imageRootPath')
      when 'outputFolder'
        return path.dirname(imagePath)
      when 'host'
        return req.get('host')
      when 'ocropyLanguageModelsPath'
        return nconf.get('paths:ocropyLanguageModelsPath')
      when 'startUp'
        return neededParameters['startUp']
      when 'resultFile'
        return '##resultFile##'
  # ---
  # **matchParams**</br>
  # Matches the received parameter values to the needed parameters</br>
  # `params`
  #   *inputParameters* The received parameters and its values
  #   *inputHighlighter* The received input highlighter
  #   *neededParameters*  The needed parameteres
  #   *imagePath* path to the input image
  #   *req* incoming request
  matchParams: (inputParameters, inputHighlighter, neededParameters,imagePath, req) ->
    params = []
    data = []
    for parameter of neededParameters
      #build parameters
      if checkReservedParameters parameter
        #check if highlighter
        if parameter is 'highlighter'
          params.push(this.getHighlighterParamValues(neededParameters[parameter], inputHighlighter))
        else
          data.push(this.getReservedParamValue(parameter, neededParameters, imagePath, req))
      else
        value = this.getParamValue(parameter, inputParameters)
        if value?
          params.push(value)
    result =
      params: params
      data: data
    return result

  buildGetUrl: (method, imagePath, neededParameters, parameterValues) ->
    getUrl = 'http://' + nconf.get('server:rootUrl') + method + '?'
    i = 0
    for key, value of neededParameters
      if(!checkReservedParameters(key))
        getUrl += key + '=' + parameterValues[i] + '&'
        i++
    getUrl += 'md5=' + imagePath
    return getUrl
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
  getHighlighterParamValues: (neededHighlighter, inputHighlighter, callback) ->
    # TODO: Is this actually needed?
    #if(neededHighlighter is not inputHighlighter['type'])
    #  error = []
    #  error.code = 500
    #  error.statusText = 'inputHighlighter does not match the requested highlighter from this method.'
    #  callback error
    #console.log 'neededHighlighter: ' + neededHighlighter
    #console.log 'inputHighlighter: ' + inputHighlighter
    #console.log 'typeof' + typeof(inputHighlighter)
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

  # ---
  # **checkReservedParameters**</br>
  # Checks if a parameter is in the list of reserverd words as defined in server.NODE_ENV.json</br>
  # `params`
  #   *parameter* the parameter to check
  checkReservedParameters = (parameter) ->
    reservedParameters = nconf.get('reservedWords')
    return parameter in reservedParameters
