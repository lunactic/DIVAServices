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
ConsoleResultHandler= require './resultHandlers/consoleResultHandler'
DockerManagement    = require '../docker/dockerManagement'
FileResultHandler   = require './resultHandlers/fileResultHandler'
IiifManifestParser  = require '../parsers/iiifManifestParser'
ImageHelper         = require '../helper/imageHelper'
IoHelper            = require '../helper/ioHelper'
NoResultHandler     = require './resultHandlers/noResultHandler'
Process             = require '../processingQueue/process'
ParameterHelper     = require '../helper/parameterHelper'
RandomWordGenerator = require '../randomizer/randomWordGenerator'
RemoteExecution     = require '../remoteExecution/remoteExecution'
ResultHelper        = require '../helper/resultHelper'
ServicesInfoHelper  = require '../helper/servicesInfoHelper'
Statistics          = require '../statistics/statistics'

# Expose executableHelper
executableHelper = exports = module.exports = class ExecutableHelper extends EventEmitter

  # ---
  # **constructor**</br>
  constructor: ->
    @remoteExecution = new RemoteExecution(nconf.get('remoteServer:ip'),nconf.get('remoteServer:user'))

  # ---
  # **buildCommand**</br>
  # Builds the command line executable command</br>
  # `params:`
  #   *executablePath*  The path to the executable
  #   *inputParameters* The received parameters and its values
  #   *neededParameters*  The list of needed parameters
  #   *programType* The program type
  buildCommand = (executablePath, programType, params) ->
    # get exectuable type
    execType = getExecutionType programType
    # return the command line call
    #dataPath = _.values(data).join(' ')
    paramsPath = ""
    params = _.values(params).join(' ').split(' ')
    for param in _.values(params)
      paramsPath += '"' + param + '" '

    return execType + ' ' + executablePath + ' ' + paramsPath

  buildRemoteCommand = (process) ->
    params = _.clone(process.parameters.params)
    #paths = _.clone(process.parameters.data)
    _.forIn(params, (value, key) ->
      switch key
        when 'inputImage','outputImage','resultFile'
          extension = path.extname(value)
          filename = path.basename(value,extension)
          params[key] = process.rootFolder + '/' + filename + extension
        when 'outputFolder'
          params[key] = process.rootFolder + '/'
    )

    _.forOwn(_.intersection(_.keys(params),_.keys(nconf.get('remotePaths'))), (value,key) ->
      params[value] = nconf.get('remotePaths:'+value)
    )


    paramsPath = _.values(params).join(' ')
    return 'qsub -o ' + process.rootFolder + ' -e ' + process.rootFolder + ' ' + process.executablePath + ' ' + paramsPath

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
      Statistics.endRecording(statIdentifier, process.req.originalUrl)
      resultHandler.handleResult(error, stdout, stderr ,process, callback)
    )

  # ---
  # **getExecutionType**</br>
  # Returns the command for a given program type (e.g. java -jar for a java program)</br>
  # `params`
  #   *programType* the program type
  getExecutionType = (programType) ->
    switch programType
      when 'java'
        return 'java -Djava.awt.headless=true -Xmx4096m -jar'
      when 'coffeescript'
        return 'coffee'
      else
        return ''

  executeLocalRequest: (process) ->
    self = @
    async.waterfall [
      (callback) ->
        process.id = Statistics.startRecording(process.req.originalUrl,process)
        #fill executable path with parameter values
        command = buildCommand(process.executablePath, process.programType, process.parameters.params)
        #if we have a console output, pipe the stdout to a file but keep stderr for error handling
        if(process.resultType == 'console')
          command += ' 1>' + process.tmpResultFile + ';mv ' + process.tmpResultFile + ' ' + process.resultFile
        self.executeCommand(command, process.resultHandler, process.id, process, callback)

      #finall callback, handling of the result and returning it
      ], (err, results) ->
        #start next execution
        self.emit('processingFinished')


  executeRemoteRequest: (process) ->
    self = @
    async.waterfall [
      (callback) ->
        self.remoteExecution.uploadFile(process.image.path, process.rootFolder, callback)
      (callback) ->
        command = buildRemoteCommand(process)
        process.id = Statistics.startRecording(process.req.originalUrl, process)
        command += ' ' + process.id + ' ' + process.rootFolder + ' > /dev/null'
        self.remoteExecution.executeCommand(command, callback)
    ], (err) ->
      if err?
        console.log 'error', err
      #self.emit('processingFinished')

  executeDockerRequest: (process) ->
    process.id = Statistics.startRecording(process.req.originalUrl,process)
    process.remoteResultUrl = 'http://' + nconf.get('docker:reportHost') + '/jobs/' + process.id
    serviceInfo = ServicesInfoHelper.getServiceInfoByPath(process.req.originalUrl)
    DockerManagement.runDockerImage(process, serviceInfo.image_name)

  preprocess: (req,processingQueue, requestCallback, queueCallback) ->
    serviceInfo = ServicesInfoHelper.getServiceInfoByPath(req.originalUrl)
    ioHelper = new IoHelper()
    parameterHelper = new ParameterHelper()
    collection = new Collection()
    collection.method = serviceInfo.service
    async.waterfall [
      (callback) ->
        #STEP 1
        #TODO Add collection exist check to here
        if (req.body.images?  and req.body.images[0].type is 'collection')
          preprocessCollection(collection, req, serviceInfo, parameterHelper, callback)
        else if(req.body.images?  and req.body.images[0].type is 'iiif')
          preprocessIiif(collection, req, ioHelper, callback)
        else
          preprocessRegular(collection, req, serviceInfo, parameterHelper,ioHelper, callback)
        return
      (collection, callback) ->
        #STEP 2
        #immediate callback if collection.result is available
        if(collection.result?)
          callback null,collection
          return
        #Create an array of processes that are added to the processing queue
        outputFolder = ioHelper.getOutputFolder(collection.name, serviceInfo.service, serviceInfo.uniqueOnCollection)
        collection.outputFolder = outputFolder
        collection.resultFile = collection.outputFolder + path.sep + 'result.json'
        for process in collection.processes
          process.outputFolder = outputFolder
          process.inputParameters = _.clone(req.body.inputs)
          process.inputHighlighters = _.clone(req.body.highlighter)
          process.neededParameters = serviceInfo.parameters
          process.method = collection.method
          process.parameters = parameterHelper.matchParams(process,req)
          if(process.parameters.params.outputImage?)
            process.parameters.params.outputImage = ImageHelper.getOutputImage(process.image, process.outputFolder)
          if(ResultHelper.checkProcessResultAvailable(process))
            process.result = ResultHelper.loadResult(process)
          else
            process.methodFolder = path.basename(process.outputFolder)
            if(process.image?)
              process.resultFile = ioHelper.buildFilePath(process.outputFolder, process.image.name)
              process.tmpResultFile = ioHelper.buildTempFilePath(process.outputFolder, process.image.name)
              process.inputImageUrl = ImageHelper.getInputImageUrl(process.rootFolder, process.image.name, process.image.extension)
            else
              process.resultFile = ioHelper.buildFilePath(process.outputFolder,process.methodFolder)
              process.tmpResultFile = ioHelper.buildTempFilePath(process.outputFolder,process.methodFolder)
            if(req.body.requireOutputImage?)
              process.requireOutputImage = req.body.requireOutputImage
            process.programType = serviceInfo.programType
            process.executablePath = serviceInfo.executablePath
            process.resultType =  serviceInfo.output
            process.resultLink = parameterHelper.buildGetUrl(process)
            resultHandler = null
            switch serviceInfo.output
              when 'console'
                resultHandler = new ConsoleResultHandler(process.resultFile)
              when 'file'
                process.parameters.params['resultFile'] = process.resultFile
                resultHandler = new FileResultHandler(process.resultFile)
              when 'none'
                delete process['resultLink']
                resultHandler = new NoResultHandler(process.resultFile)
            process.resultHandler = resultHandler
        callback null, collection
        return
      (collection, callback) ->
        #STEP 3
        for process in collection.processes
          if(!(process.result?))
            parameterHelper.saveParamInfo(process,process.parameters,process.rootFolder,process.outputFolder, process.method)
            ioHelper.writeTempFile(process.resultFile)
        callback null, collection
      ],(err, collection) ->
        #FINISH
        if(err?)
          requestCallback err, null
        results = []
        if(collection.result?)
          requestCallback null, collection.result
          return
        for process in collection.processes
          if(process.resultLink?)
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

  preprocessCollection = (collection, req, serviceInfo, parameterHelper, callback) ->
    #process a collection
    collection.name = req.body.images[0].value
    folder = nconf.get('paths:imageRootPath') + path.sep + collection.name
    collection.inputParameters = _.clone(req.body.inputs)
    collection.inputHighlighters = _.clone(req.body.highlighter)
    collection.parameters = parameterHelper.matchParams(req.body.inputs, req.body.highlighter.segments,serviceInfo.parameters,folder,folder, "", req)
    if(ResultHelper.checkCollectionResultAvailable(collection))
      collection.result = ResultHelper.loadResult(collection)
      callback null, collection
    else
      #if results not available, load images and create processes
      images = ImageHelper.loadCollection(collection.name, false)
      for image in images
        process = new Process()
        process.req = _.clone(req)
        process.rootFolder = collection.name
        process.image = image
        collection.processes.push(process)
      callback null, collection

  preprocessIiif = (collection, req, ioHelper, callback) ->
    url = req.body.images[0].value
    if(url.endsWith('.json'))
      rootFolder = url.split('/')
      rootFolder.pop()
      rootFolder = rootFolder.pop()
    else
      rootFolder = url.substr(url.lastIndexOf('/') + 1)
    collection.name = rootFolder
    ioHelper.createCollectionFolders(collection.name)
    if(ResultHelper.checkCollectionResultAvailable(collection))
      collection.result = ResultHelper.loadResult(collection)
      callback null,collection
    else
      iifManifestParser = new IiifManifestParser(req.body.images[0].value)
      iifManifestParser.initialize().then ->
        images = iifManifestParser.getAllImages(0)
        metadata = iifManifestParser.getMetadata()
        label = iifManifestParser.getLabel()
        description = iifManifestParser.getDescription()
        for inputImage,i in images
          image = ImageHelper.saveImageUrl inputImage, collection.name, i
          ImageHelper.addImageInfo image.md5, image.path, collection.name
          process = new Process()
          process.req = _.clone(req)
          process.rootFolder = collection.name
          process.image = image
          collection.processes.push(process)
        callback null, collection

  preprocessRegular = (collection, req, serviceInfo, parameterHelper, ioHelper, callback) ->
    #generte a random folder name
    rootFolder = RandomWordGenerator.generateRandomWord()
    ioHelper.createCollectionFolders(rootFolder)
    collection.name = rootFolder
    # TODO: check if an image exists, and if yes: send a JSON back with 'status':'imageExists'
    #load all images
    if req.body.images?
      inputImages = req.body.images
      for inputImage,i in inputImages
        process = new Process()
        process.req = _.clone(req)
        process.rootFolder = rootFolder
        image = ImageHelper.saveImage(inputImage, process, i)
        if(inputImage.type is 'md5')
          ioHelper.deleteCollectionFolders(collection.name)
          ImageHelper.handleMd5(image, process, collection, serviceInfo, parameterHelper, req)
          if(ResultHelper.checkCollectionResultAvailable(collection))
            collection.result = ResultHelper.loadResult(collection)
            callback null, collection
            return
        process.image = image
        collection.processes.push(process)
      callback null, collection
    else if req.body.data?
      dataUrl = req.body.data.url;
      process = new Process()
      process.req = _.clone(req)
      process.rootFolder = rootFolder
      process.hasImage = false
      async.waterfall [
        (callback) ->
          ioHelper.downloadFile(dataUrl, nconf.get('paths:imageRootPath') + path.sep + process.rootFolder, callback)
        (zipFile, callback) ->
          ioHelper.unzipFolder(zipFile, nconf.get('paths:imageRootPath') + path.sep + process.rootFolder + path.sep + 'original', callback)
      ], (error) ->
        if(error)
          logger.log 'error', error
          callback error, null
        else
          process.inputFolder = nconf.get('paths:imageRootPath') + path.sep + process.rootFolder + path.sep + 'original'
          collection.processes.push(process)
          callback null, collection
          #TODO add the callback call here
          #finished
