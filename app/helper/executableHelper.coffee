childProcess  = require 'child_process'
nconf         = require 'nconf'
logger        = require '../logging/logger'
paramHelper   = require './parameterHelper'
class ExecutableHelper
  constructor: () ->
    this.params = []
    this.data = []

  params: []
  data: []

  buildExecutablePath: (req, executablePath, inputParameters, neededParameters, programType) ->
    #get exectuable type
    execType = getExecutionType programType
    return execType + ' ' + executablePath + ' ' + this.data.join(' ') + ' ' + this.params.join(' ')

  matchParams: (imagePath, inputParameters, inputHighlighter, neededParameters, callback) ->
    for parameter of neededParameters
      #build parameters
      if checkReservedParameters parameter
        #check if highlighter
        if parameter is 'highlighter'
          this.params.push(paramHelper.getHighlighterParamValues(neededParameters[parameter], inputHighlighter))
        else
          this.data.push(paramHelper.getReservedParamValue(parameter, imagePath))
      else
        value = getParamValue(parameter, inputParameters)
        if typeof value != 'undefined'
          this.params.push(value)
    return

  executeCommand: (command, callback) ->
    exec = childProcess.exec
    # (error, stdout, stderr) is a so called "callback" and thus "exec" is an asynchronous function
    # in this case, you must always put the wrapping function in an asynchronous manner too! (see line
    # 23)
    logger.log 'info', 'executing command: ' + command
    child = exec(command, { maxBuffer: 1024 * 48828 }, (error, stdout, stderr) ->
      if error?
        callback error
      else
        #console.log 'task finished. Result: ' + stdout
        callback null, stdout
    )

  getExecutionType = (programType) ->
    switch programType
      when 'java'
        return 'java -jar'
      else
        return ''

  getParamValue = (parameter, inputParameters) ->
    if inputParameters.hasOwnProperty(parameter)
      return inputParameters[parameter]
    return

  checkReservedParameters = (parameter) ->
    reservedParameters = nconf.get('reservedWords')
    return parameter in reservedParameters

module.exports = ExecutableHelper
