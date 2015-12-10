# ExecutableHelper
# =======
#
# **ExecutableHelper** provides helper methods to build the command line call
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependencies
childProcess        = require 'child_process'
async               = require 'async'
{EventEmitter}      = require 'events'
_                   = require 'lodash'
ImageHelper         = require '../helper/imageHelper'
IoHelper            = require '../helper/ioHelper'
ParameterHelper     = require '../helper/parameterHelper'
ServicesInfoHelper  = require '../helper/servicesInfoHelper'
Statistics          = require '../statistics/statistics'
logger              = require '../logging/logger'
Process             = require '../processingQueue/process'
ConsoleResultHandler= require '../helper/resultHandlers/consoleResultHandler'
FileResultHandler   = require '../helper/resultHandlers/fileResultHandler'

# Expose executableHelper
executableHelper = exports = module.exports = class ExecutableHelper extends EventEmitter

  # ---
  # **constructor**</br>
  constructor: ->
  # ---
  # **buildCommand**</br>
  # Builds the command line executable command</br>
  # `params:`
  #   *executablePath*  The path to the executable
  #   *inputParameters* The received parameters and its values
  #   *neededParameters*  The list of needed parameters
  #   *programType* The program type
  buildCommand = (executablePath, programType, data, params) ->
    # get exectuable type
    execType = getExecutionType programType
    # return the command line call
    dataPath = _.valuesIn(data).join(' ')
    paramsPath = _.valuesIn(params).join(' ')
    return execType + ' ' + executablePath + ' ' + dataPath+ ' ' + paramsPath

  # ---
  # **executeCommand**</br>
  # Executes a command using the [childProcess](https://nodejs.org/api/child_process.html) module
  # Returns the data as received from the stdout.</br>
  # `params`
  #   *command* the command to execute
  executeCommand: (command, resultHandler, statIdentifier,process, callback) ->
    exec = childProcess.exec
    logger.log "info", 'executing command: ' + command
    child = exec(command, { maxBuffer: 1024 * 48828 }, (error, stdout, stderr) ->
      resultHandler.handleResult(error, stdout, stderr, statIdentifier,process, callback)
    )

  # ---
  # **getExecutionType**</br>
  # Returns the command for a given program type (e.g. java -jar for a java program)</br>
  # `params`
  #   *programType* the program type
  getExecutionType = (programType) ->
    switch programType
      when 'java'
        return 'java -Djava.awt.headless=true -jar'
      when 'coffeescript'
        return 'coffee'
      else
        return ''

  executeRequest: (process, requestCallback) ->
      self = @
      async.waterfall [
        (callback) ->
          statIdentifier = Statistics.startRecording(process.req.originalUrl)
          #fill executable path with parameter values
          command = buildCommand(process.executablePath, process.programType, process.parameters.data, process.parameters.params)
          #if we have a console output, pipe the stdout to a file but keep stderr for error handling
          if(process.resultType == 'console')
            command += ' 1>' + process.tmpFilePath + ';mv ' + process.tmpFilePath + ' ' + process.filePath
          self.executeCommand(command, process.resultHandler, statIdentifier, process, callback)
          return
        #finall callback, handling of the result and returning it
        ], (err, results) ->
          #strip the image out of the response if needed
          if(!process.requireOutputImage)
            delete results['image']

          #start next execution
          if(requestCallback?)
            requestCallback null, results
          else
            self.emit('processingFinished')

  preprocessing: (req,processingQueue,immediateExecution, requestCallback, queueCallback) ->
    serviceInfo = ServicesInfoHelper.getServiceInfo(req.originalUrl)
    ioHelper = new IoHelper()
    parameterHelper = new ParameterHelper()
    processes = []
    async.waterfall [
      (callback) ->
        inputImages = req.body.images
        images = []
        #TODO: Differentiate beween req.body.images.size() == 1 or >1
        for image in inputImages
          process = new Process()
          process.req = req

          if(image.type is 'image')
            images.push ImageHelper.saveImage(image.value)
          else if (image.type is 'url')
            images.push ImageHelper.saveImageUrl(image.value)
          else if (image.type is 'md5')
            images.push ImageHelper.loadImageMd5(image.value)
          processes.push(process)
        callback null, images, processes
        return
      #perform parameter matching
      (images,processes, callback) ->
        #TODO: Expand this to a loop
        #Create an array of processes that are added to the processing queue
        for image, i in images
          process = processes[i]
          process.imagePath = image.path
          process.imageFolder = image.folder
          process.neededParameters = serviceInfo.parameters
          process.inputParameters = req.body.inputs
          process.inputHighlighters = req.body.highlighter
          process.parameters = parameterHelper.matchParams(process.inputParameters, process.inputHighlighters.segments,process.neededParameters,process.imagePath,image.md5, req)
          if(req.body.requireOutputImage?)
            process.requireOutputImage = req.body.requireOutputImage
          process.programType = serviceInfo.programType
          process.executablePath = serviceInfo.executablePath
          process.resultType =  serviceInfo.output
          process.method = parameterHelper.getMethodName(req.originalUrl)
          process.filePath = ioHelper.buildFilePath(image.folder, req.originalUrl, process.parameters.params)
          process.tmpFilePath = ioHelper.buildTempFilePath(image.folder, req.originalUrl, process.parameters.params)
          process.inputImageUrl = ImageHelper.getInputImageUrl(image.md5)
          if(process.neededParameters.outputImage?)
            process.outputImageUrl = ImageHelper.getOutputImageUrl(image.md5)
          process.resultLink = parameterHelper.buildGetUrl(req.originalUrl,image.md5, process.neededParameters, process.parameters.params, process.inputHighlighters)
          resultHandler = null
          switch serviceInfo.output
            when 'console'
              resultHandler = new ConsoleResultHandler(process.filePath);
            when 'file'
              process.parameters.data['resultFile'] = process.filePath
              resultHandler = new FileResultHandler(process.filePath);
          process.resultHandler = resultHandler
          #callback null
        callback null, processes
        return

      #try to load results from disk
      (processes,callback) ->
        #try to load results for each process
        #TODO ADD RESULTS TO PROCESS
        for process in processes
          ioHelper.loadResult process.imageFolder, req.originalUrl, process.parameters.params, true, () ->
            if(data?)
              process.result = data
        return
      (data, callback) ->
        #todo change imageHelper.md5 to image/process.md5
        @getUrl = parameterHelper.buildGetUrl(req.originalUrl,imageHelper.md5, @neededParameters, @parameters.params, @inputHighlighters)
        if(data?)
          if(!process.requireOutputImage)
            delete data['image']
          callback null, data
        else
          ioHelper.writeTempFile(process.filePath, callback)
      ],(err, results) ->
        if(err?)
          requestCallback err, null
        else
          if(results?)
            requestCallback err,results
          else if !immediateExecution
            processingQueue.addElement(process)
            requestCallback err, {'status':'planned', 'url':@getUrl}
            queueCallback()
          else
            processingQueue.addElement(process)
            queueCallback()
