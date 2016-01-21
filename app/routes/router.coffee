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
Upload      = require '../upload/upload'
ImageHelper = require '../helper/imageHelper'
ResultHelper= require '../helper/resultHelper'

getHandler = new GetHandler()
postHandler = new PostHandler()

# Set up special route for image uploading
router.post '/upload', (req, res) ->
  if(req.body.image?)
    Upload.uploadBase64 req.body.image, (err,result) ->
      res.json {md5: result.md5}
  else if(req.body.url?)
    Upload.uploadUrl req.body.url, (err,result) ->
      res.json {md5: result.md5}

# Set up the routing for POST requests
router.post '*', (req, res, next) ->
  postHandler.handleRequest req, (err, response) ->
    sendResponse res, err, response

router.get '/image/check/:md5', (req,res) ->
  ImageHelper.imageExists req.params.md5, (err, response) ->
    sendResponse res, err, response

router.get '/image/results/:md5', (req, res)->
  ImageHelper.imageExists req.params.md5, (err, response) ->
    if(response.imageAvailable)
      images = ImageHelper.loadImagesMd5(req.params.md5)
      response = []
      for image in images
        availableResults = ResultHelper.loadAvailableResults(image.rootFolder, image)
        for result in availableResults
          message =
            resultLink: result.resultLink
            method: result.method
            collectionName: result.collectionName
            parameters: result.parameters
          response.push message

      response['status'] = 'done'
      sendResponse res, null, response
    else
      err =
        status: 404
        statusText: 'This result is not available'
      send response res, err, null

# Set up the routing for GET requests
router.get '*', (req, res, next) ->
  getHandler.handleRequest req, (err, response) ->
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
    res.status err.status or 500
    error =
      status: err.status
      message: err.statusText

    res.json error
    logger.log 'error', err.statusText
  else
    res.status 200
    #parse an unparsed json string to get a correct response
    try
      res.json JSON.parse(response)
    catch error
      res.json response

# Expose router
module.exports = router
