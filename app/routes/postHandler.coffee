# PostHandler
# =======
#
# **PostHandler** uses the [async](https://github.com/caolan/async) module
# for handling all incoming POST requests. POST requests trigger the server to execute
# the requested method. Executing a method consists of several steps:
# 1. extract the submitted image
# 2. match the recieved parameters to the requested parameters as defined in services.json
# 3. try to load the results from disk. If results are found, immediately return them
# 4. If no results found, build the command for the commmand line callback
# 5. Save the results
# 6. return the results
#
# These steps are performed using (async > waterfall)[https://github.com/caolan/async#waterfall]
# to ensure ordered execution.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# module requirements
fs                  = require 'fs'
async               = require 'async'
ImageHelper         = require '../helper/imageHelper'
ExecutableHelper    = require '../helper/executableHelper'
IoHelper            = require '../helper/ioHelper'
ParameterHelper     = require '../helper/parameterHelper'
ServicesInfoHelper  = require '../helper/servicesInfoHelper'
Statistics          = require '../statistics/statistics'
logger              = require '../logging/logger'
QueueHandler        = require '../processingQueue/queueHandler'
#Expose postHandler
postHandler = exports = module.exports = class PostHandler
  constructor: () ->
    @queueHandler = new QueueHandler()
  # ---
  # **handleRequest**</br>
  # Handle incoming POST requests</br>
  # `params`
  #   *req* the incoming request
  handleRequest: (req, cb) ->
    @queueHandler.addRequestToQueue(req)
    #serviceInfo = ServicesInfoHelper.getServiceInfo(req.originalUrl)
    #if typeof serviceInfo != 'undefined'
    #  imageHelper = new ImageHelper()
    #  executableHelper = new ExecutableHelper()
    #  ioHelper = new IoHelper()
    #  parameterHelper = new ParameterHelper()
    #  ###
    #    perform all the steps using an async waterfall
    #    Each part will be executed and the response is passed on to the next
    #    function.
    #  ###
      #async.waterfall [
      #  # check if current method is already in execution
      #  # and can not handle multiple executions
      #  (callback) ->
      #    if(!serviceInfo.allowParallel and Statistics.isRunning(req.originalUrl))
      #      # add request to a processing queue
      #      error =
      #        statusText: 'This method can not be run in parallel'
      #        status: 500
      #      callback error
      #    else
      #      callback null
      #  # save image
      #  (callback) ->
      #    if(req.body.image?)
      #      imageHelper.saveImage(req.body.image, callback)
      #    else if (req.body.url?)
      #      imageHelper.saveImageUrl(req.body.url, callback)
      #    return
      #  #perform parameter matching
      #  (imagePath, callback) ->
      #    @imagePath = imagePath
      #    @neededParameters = serviceInfo.parameters
      #    @inputParameters = req.body.inputs
      #    @inputHighlighters = req.body.highlighter
      #    @programType = serviceInfo.programType
      #    @parameters = parameterHelper.matchParams(@inputParameters, @inputHighlighters.segments,@neededParameters,@imagePath, req)
      #    callback null
      #    return
        #try to load results from disk
      #  (callback) ->
      #    ioHelper.loadResult(imageHelper.imgFolder, req.originalUrl, @parameters.params, true, callback)
      #    return
        #execute method if not loaded
      #  (data, callback) ->
      #    if(data?)
      #      callback null, data, -1, true
      #    else
      #      statIdentifier = Statistics.startRecording(req.originalUrl)
            #fill executable path with parameter values
      #      command = executableHelper.buildCommand(serviceInfo.executablePath, @programType, @parameters.data, @parameters.params)
      #      executableHelper.executeCommand(command, statIdentifier, callback)
      #    return
      #  (data, statIdentifier, fromDisk, callback) ->
      #    if(fromDisk)
      #      callback null, data
          #save the response
      #    else
      #      console.log 'exeucted command in ' + Statistics.endRecording(statIdentifier, req.originalUrl) + ' seconds'
      #      ioHelper.saveResult(imageHelper.imgFolder, req.originalUrl, @parameters.params, data, callback)
      #    return
      #  #finall callback, handling of the result and returning it
      #  ], (err, results) ->
      #    if(err?)
      #      cb err,
      #    else
      #      cb err, results
      #  return
