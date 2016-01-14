# ExecutableHelper
# =======
#
# **ExecutableHelper** provides helper methods to build the command line call
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependencies
_                   = require 'lodash'
async               = require 'async'
childProcess        = require 'child_process'
{EventEmitter}      = require 'events'
nconf               = require 'nconf'
path                = require 'path'
logger              = require '../logging/logger'
Collection          = require '../processingQueue/collection'
ConsoleResultHandler= require '../helper/resultHandlers/consoleResultHandler'
FileResultHandler   = require '../helper/resultHandlers/fileResultHandler'
ImageHelper         = require '../helper/imageHelper'
IoHelper            = require '../helper/ioHelper'
Process             = require '../processingQueue/process'
ParameterHelper     = require '../helper/parameterHelper'
RandomWordGenerator = require '../randomizer/randomWordGenerator'
ResultHelper        = require '../helper/resultHelper'
ServicesInfoHelper  = require '../helper/servicesInfoHelper'
Statistics          = require '../statistics/statistics'

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
            command += ' 1>' + process.tmpResultFile + ';mv ' + process.tmpResultFile + ' ' + process.resultFile
          self.executeCommand(command, process.resultHandler, statIdentifier, process, callback)

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
    collection = new Collection()
    collection.method = parameterHelper.getMethodName(req.originalUrl)
    async.waterfall [
      (callback) ->
        inputImages = req.body.images
        if !(req.body.images[0].collection?)
          #generte a random folder name
          rootFolder = RandomWordGenerator.generateRandomWord()
          collection.name = rootFolder
          # TODO:   check if an image exists, and if yes: send a JSON back with 'status':'imageExists'
          #load all images
          for inputImage,i in inputImages
            process = new Process()
            process.req = req
            process.rootFolder = rootFolder
            image = {}
            if(inputImage.type is 'image')
              image = ImageHelper.saveOriginalImage(inputImage.value,process.rootFolder,i)
              ImageHelper.addImageInfo(image.md5, image.path)
            else if (inputImage.type is 'url')
              image = ImageHelper.saveImageUrl(inputImage.value,process.rootFolder, i)
              ImageHelper.addImageInfo(image.md5, image.path)
            else if (inputImage.type is 'md5')
              #simply take the first image that is returned
              image = ImageHelper.loadImagesMd5(inputImage.value)[0]
              rootFolder = image.folder.split(path.sep)[image.folder.split(path.sep).length-2]
              #Overwrite the root folder
              process.rootFolder = rootFolder
              collection.name = rootFolder
              #TODO Refactor this part
              folder = nconf.get('paths:imageRootPath') + path.sep + collection.name
              collection.parameters = parameterHelper.matchParams(req.body.inputs, req.body.highlighter.segments,serviceInfo.parameters,folder,folder, "", req)
              if(ResultHelper.checkCollectionResultAvailable(collection))
                collection.result = ResultHelper.loadResult(collection)
            process.image = image
            collection.processes.push(process)
        #process a collection
        else
          collection.name = req.body.images[0].collection
          folder = nconf.get('paths:imageRootPath') + path.sep + collection.name
          collection.parameters = parameterHelper.matchParams(req.body.inputs, req.body.highlighter.segments,serviceInfo.parameters,folder,folder, "", req)
          if(ResultHelper.checkCollectionResultAvailable(collection))
            collection.result = ResultHelper.loadResult(collection)
        callback null, collection
        return
      (collection, callback) ->
        #immediate callback if collection.result is available
        if(collection.result?)
          callback null,collection

        #Create an array of processes that are added to the processing queue
        outputFolder = ioHelper.getOutputFolder(collection.name, serviceInfo.service)
        collection.outputFolder = outputFolder
        collection.resultFile = collection.outputFolder + path.sep + 'result.json'
        for process in collection.processes
          process.outputFolder = outputFolder
          process.inputParameters = req.body.inputs
          process.inputHighlighters = req.body.highlighter
          process.neededParameters = serviceInfo.parameters
          process.method = collection.method
          process.parameters = parameterHelper.matchParams(process.inputParameters, process.inputHighlighters.segments,process.neededParameters,process.image.path,process.outputFolder, process.image.md5, req)
          if(ResultHelper.checkProcessResultAvailable(process))
            process.result = ResultHelper.loadResult(process)
          else
            process.methodFolder = path.basename(process.outputFolder)
            process.resultFile = ioHelper.buildFilePath(process.outputFolder, process.image.name)
            process.tmpResultFile = ioHelper.buildTempFilePath(process.outputFolder, process.image.name)
            if(req.body.requireOutputImage?)
              process.requireOutputImage = req.body.requireOutputImage
            process.programType = serviceInfo.programType
            process.executablePath = serviceInfo.executablePath
            process.resultType =  serviceInfo.output
            process.inputImageUrl = ImageHelper.getInputImageUrl(process.rootFolder, process.image.name, process.image.extension)
            process.outputImageUrl = ImageHelper.getOutputImageUrl(process.rootFolder + '/' + process.methodFolder, process.image.name, process.image.extension )
            process.resultLink = parameterHelper.buildGetUrl(process)
            resultHandler = null
            switch serviceInfo.output
              when 'console'
                resultHandler = new ConsoleResultHandler(process.resultFile);
              when 'file'
                process.parameters.data['resultFile'] = process.resultFile
                resultHandler = new FileResultHandler(process.resultFile);
            process.resultHandler = resultHandler
          callback null, collection
          return
        return
      (collection, callback) ->
        for process in collection.processes
          if(process.result?)
            if(!process.requireOutputImage && process.result.hasOwnProperty('image'))
              delete process.result['image']
          else
            parameterHelper.saveParamInfo(process,process.parameters,process.rootFolder,process.outputFolder, process.method)
            ioHelper.writeTempFile(process.resultFile)
        callback null, collection
      ],(err, collection) ->
        if(err?)
          requestCallback err, null
        results = []
        if(collection.result?)
          requestCallback null, collection.result
          return
        for process in collection.processes
          results.push({'resultLink':process.resultLink})
          if(!process.result?)
            processingQueue.addElement(process)
            queueCallback()
        message =
          results: results
          collection: collection.name
          resultLink: parameterHelper.buildGetUrlCollection(collection)
          status: 'done'
        #if process results were loaded from disk no need to save here
        #check if collection.resultFile folder exists
        collection.result = message
        ResultHelper.saveResult(collection)
        requestCallback null, collection.result
