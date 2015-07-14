childProcess = require 'child_process'

class ExecutableHelper
  constructor: () ->

  buildExecutablePath: (req, imagePath, executablePath, inputParameters, neededParameters) ->
    for parameter of neededParameters
      #find matching input parameter
      imagePattern =  /// ^ #begin of line
        ([\w.-]*)         #zero or more letters, numbers, _ . or -
        ([iI]mage)         #followed by image or Image
        ([\w.-]*)         #then zero or more letters, numbers, _ . or -
        $ ///i            #end of line and ignore case
      if parameter.match imagePattern
        console.log imagePath
        executablePath+= ' ' + imagePath
      else
        value = getParamValue(parameter, inputParameters)
        if typeof value != 'undefined'
          executablePath += ' ' + value
    return executablePath

  executeCommand: (command) ->
    exec = childProcess.exec
    child = exec('java -jar ' + command, (error, stdout, stderr) ->
      console.log 'stdout: ' + stdout
      console.log 'stderr: ' + stderr
      if error != null
        console.log 'exec error: ' + error
      return stdout
    )

  getParamValue = (parameter, inputParameters) ->
    if inputParameters.hasOwnProperty(parameter)
      return inputParameters[parameter]
    return


module.exports = ExecutableHelper
