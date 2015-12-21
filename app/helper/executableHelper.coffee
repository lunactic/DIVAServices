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
RandomWordGenerator = require '../randomizer/randomWordGenerator'

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

  executeRequest: (process) ->
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
          self.emit('processingFinished')

  preprocessing: (req,processingQueue,immediateExecution, requestCallback, queueCallback) ->
    serviceInfo = ServicesInfoHelper.getServiceInfo(req.originalUrl)
    ioHelper = new IoHelper()
    parameterHelper = new ParameterHelper()
    processes = []
    async.waterfall [
      (callback) ->
        inputImages = req.body.images
        if inputImages.length > 1
          #generte a random folder name
          @rootFolder = RandomWordGenerator.generateRandomWord()
          #save all images
          for inputImage,i in inputImages
            process = new Process()
            process.req = req
            process.rootFolder = @rootFolder
            image = {}
            if(inputImage.type is 'image')
              image = ImageHelper.saveImage(inputImage.value)
            else if (inputImage.type is 'url')
              image = ImageHelper.saveImageUrl(inputImage.value,process.rootFolder, i)
            else if (inputImage.type is 'md5')
              image = ImageHelper.loadImageMd5(inputImage.value)
            ImageHelper.addImageInfo(image.md5, image.path)
            process.image = image
            processes.push(process)
        else
          #process a collection
          if(req.body.images[0].collection?)
            images = ImageHelper.loadCollection(req.body.images[0].collection)
            @rootFolder = req.body.images[0].collection
            for image in images
              process = new Process()
              process.req = req
              process.rootFolder = @rootFolder
              process.image = image
              processes.push(process)
        callback null, processes
        return
      #receive all information for a process
      (processes, callback) ->
        #Create an array of processes that are added to the processing queue
        outputFolder = ioHelper.getOutputFolder(@rootFolder, serviceInfo.service)
        for process in processes
          process.outputFolder = outputFolder
          process.neededParameters = serviceInfo.parameters
          process.inputParameters = req.body.inputs
          process.inputHighlighters = req.body.highlighter
          process.parameters = parameterHelper.matchParams(process.inputParameters, process.inputHighlighters.segments,process.neededParameters,process.image.path,process.image.md5, req)
          process.method = parameterHelper.getMethodName(req.originalUrl)
          process.filePath = ioHelper.buildFilePath(process.outputFolder, process.image.name)
          process.tmpFilePath = ioHelper.buildTempFilePath(process.outputFolder, process.image.name)
          #NOTE: this might change process.filePath and process.outputFolder
          parameterHelper.loadParamInfo process,process.rootFolder,process.method
          if(req.body.requireOutputImage?)
            process.requireOutputImage = req.body.requireOutputImage
          process.programType = serviceInfo.programType
          process.executablePath = serviceInfo.executablePath
          process.resultType =  serviceInfo.output
          process.inputImageUrl = ImageHelper.getInputImageUrl(process.rootFolder, process.image.name, process.image.extension)
          if(process.neededParameters.outputImage?)
            process.outputImageUrl = ImageHelper.getOutputImageUrl(process.rootFolder + '/' + process.outputFolder, process.image.name, process.image.extension )
          process.resultLink = parameterHelper.buildGetUrl(process)
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
        for process in processes
          data = ioHelper.loadResult process.filePath
          if(data?)
            process.result = data
        callback null, processes
        return
      (processes, callback) ->
        for process in processes
          if(process.data?)
            if(!process.requireOutputImage)
              delete process.data['image']
          else
            parameterHelper.saveParamInfo(process,process.parameters,process.rootFolder,process.outputFolder, process.method)
            ioHelper.writeTempFile(process.filePath)
        callback null, processes
      ],(err, processes) ->
        if(err?)
          requestCallback err, null
        if processes.length == 1
          process = processes[0]
          if(process.results?)
            requestCallback err,results
          else if !immediateExecution
            processingQueue.addElement(process)
            requestCallback err, {'status':'planned', 'url':process.resultLink}
            queueCallback()
          else
            processingQueue.addElement(process)
            queueCallback()
        else if processes.length > 1
          #what to return here??
          results = []
          for process in processes
            results.push({'resultLink':process.resultLink})
            if(!process.result?)
              processingQueue.addElement(process)
              queueCallback()
          message =
            results: results
            collection: processes[0].rootFolder
          requestCallback null, message
