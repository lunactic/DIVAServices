childProcess = require 'child_process'

class ExecutableHelper
  constructor: () ->
    this.params = []
    this.data = []

  buildExecutablePath: (req, imagePath, executablePath, inputParameters, neededParameters, programType) ->
    #get exectuable type
    execType = getExecutionType programType
    params: []
    data: []
    for parameter of neededParameters
      #build parameters
      imagePattern =  /// ^ #begin of line
        ([\w.-]*)         #zero or more letters, numbers, _ . or -
        ([iI]mage)         #followed by image or Image
        ([\w.-]*)         #then zero or more letters, numbers, _ . or -
        $ ///i            #end of line and ignore case
      if parameter.match imagePattern
        this.data.push imagePath
      else
        value = getParamValue(parameter, inputParameters)
        if typeof value != 'undefined'
          this.params.push value
    return execType + ' ' + executablePath + ' ' + this.data.join(' ') + ' ' + this.params.join(' ')

  executeCommand: (command, callback) ->
    exec = childProcess.exec
    # (error, stdout, stderr) is a so called "callback" and thus "exec" is an asynchronous function
    # in this case, you must always put the wrapping function in an asynchronous manner too! (see line
    # 23)
    child = exec(command, (error, stdout, stderr) ->
      if error?
        callback error
      else
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


module.exports = ExecutableHelper
