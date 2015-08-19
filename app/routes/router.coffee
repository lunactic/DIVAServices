# Router
# =======
#
# **Router** uses the [Express > Router](http://expressjs.com/api.html#router) middleware
# for handling all routing from DIVAServices.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Require Express Router
router      = require('express').Router()
GetHandler  = require './getHandler'
PostHandler = require './postHandler'
logger      = require '../logging/logger'

getHandler = new GetHandler()
postHandler = new PostHandler()



router.post '/segmentation/textline/gabor*', (req, res, next) ->
  imageHelper = new ImageHelper()
  executableHelper = new ExecutableHelper()
  ioHelper = new IoHelper()
  if(req.originalUrl.indexOf('merge') > -1)
    command = 'java -jar /data/executables/gabortextlinesegmentation/gabortextlinesegmentation.jar merge ' + req.body.mergePolygon1 + ' ' + req.body.mergePolygon2
    executableHelper.executeCommand command, null, (err, data, statIdentifier, fromDisk, callback) ->
      res.status 200
      res.json JSON.parse data
      logger.log 'info', 'RESPONSE 200'
  else if (req.originalUrl.indexOf('split') > -1)
    command = 'java -jar /data/executables/gabortextlinesegmentation/gabortextlinesegmentation.jar split ' + req.body.splitPolygon + ' ' + req.body.xSplit + ' ' + req.body.ySplit
    executableHelper.executeCommand command, null, (err, data, statIdentifier, fromDisk, callback) ->
      res.status 200
      res.json JSON.parse data
      logger.log 'info', 'RESPONSE 200'
  else if (req.originalUrl.indexOf('erase') > -1)
    command = 'java -jar /data/executables/gabortextlinesegmentation/gabortextlinesegmentation.jar delete ' + req.body.erasePolygon + ' ' + req.body.xErase + ' ' + req.body.yErase
    executableHelper.executeCommand command, null, (err, data, statIdentifier, fromDisk, callback) ->
      res.status 200
      res.json JSON.parse data
      logger.log 'info', 'RESPONSE 200'
  else
    async.waterfall [
      (callback) ->
        imageHelper.saveImageUrl(req.body.url, callback)
        return
      #perform parameter matching
      (imagePath, callback) ->
        console.log 'imgHelper.imgFolder: ' + imageHelper.imgFolder
        @params = []
        @imagePath = imagePath
        @top = req.body.top
        @bottom = req.body.bottom
        @left = req.body.left
        @right = req.body.right
        @linkingRectWidth = req.body.linkingRectWidth
        @linkingRectHeight = req.body.linkingRectHeight
        @params.push @top
        @params.push @bottom
        @params.push @left
        @params.push @right
        @params.push @linkingRectWidth
        @params.push @linkingRectHeight
        callback null
        return
      (callback) ->
        ioHelper.loadResult(imageHelper.imgFolder, req.originalUrl, @params, callback)
        return
      (data, callback) ->
        if(data?)
          callback null, data, -1, true
        else
          #fill executable path with parameter values
          #command = executableHelper.buildCommand(arrayFound[0].executablePath, @inputParameters, @neededParameters, @programType)
          command = 'java -jar /data/executables/gabortextlinesegmentation/gabortextlinesegmentation.jar create ' + @imagePath + ' input ' + nconf.get('paths:matlabScriptsPath') + ' ' + nconf.get('paths:matlabPath') + ' ' + @top + ' ' + @bottom + ' ' + @left + ' ' + @right + ' ' + @linkingRectWidth + ' ' + @linkingRectHeight
          executableHelper.executeCommand(command, null, callback)
        return
      (data, statIdentifier, fromDisk, callback) ->
        if(fromDisk)
          callback null, data
        #save the response
        else
          ioHelper.saveResult(imageHelper.imgFolder, req.originalUrl, @params, data, callback)
        return
      #finall callback, handling of the result and returning it
      ], (err, results) ->
        if err?
          logger.log 'error', JSON.stringify(err)
          res.status err.status or 500
          res.json err.statusText
          logger.log 'error', err.statusText
        else
          res.status 200
          res.json JSON.parse results
          logger.log 'info', 'RESPONSE 200'



# Set up the routing for GET requests
router.get '*', (req, res, next) ->
  logger.log 'info', 'GET ' + req.originalUrl
  getHandler.handleRequest req, (err, response) ->
    sendResponse res, err, response

# Set up the routing for POST requests
router.post '*', (req, res, next) ->
  logger.log 'info', 'POST ' + req.originalUrl
  postHandler.handleRequest req, (err, response) ->
    sendResponse res, err, response

# ---
# **sendResponse**</br>
# Send response back to the caller </br>
# `params`
#   *res* response object from the express framework
#   *err* possible error message. If set a HTTP 500 will be returned
#   *response* the JSON response. If set a HTTP 200 will be returned
sendResponse = (res, err, response) ->
  if err?
    logger.log 'error', JSON.stringify(err)
    res.status err.status or 500
    res.json err.statusText
    logger.log 'error', err.statusText
  else
    res.status 200
    res.json response
    logger.log 'info', 'RESPONSE 200'

# Expose router
module.exports = router
