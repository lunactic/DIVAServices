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
QueueHandler        = require '../processingQueue/queueHandler'
ServicesInfoHelper  = require '../helper/servicesInfoHelper'
logger              = require '../logging/logger'
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
    serviceInfo = ServicesInfoHelper.getServiceInfoByPath(req.originalUrl)

    switch serviceInfo.execute
      when 'remote'
        #execute remote
        @queueHandler.addRemoteRequestToQueue(req, cb)
      when 'local'
        @queueHandler.addLocalRequestToQueue(req,cb)
      when 'docker'
        @queueHandler.addDockerRequestToQueue(req,cb)
      else
        logger.log 'error', 'error in definition for method: ' + req.originalUrl
        error =
          statusCode: 500
          statusText: 'error in method definition'
        callback(error, null)