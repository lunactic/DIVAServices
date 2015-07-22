# Router
# =======
#
# **Router** uses the [Express > Router](http://expressjs.com/api.html#router) middleware
# for handling all routing from DIVAServices.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Require Express Router
router      = require('express').Router()
GetHandler  = require('./getHandler')
PostHandler = require('./postHandler')
logger      = require('../logging/logger')


getHandler = new GetHandler()
postHandler = new PostHandler()

# Set up the routing for GET requests
router.get '*', (req, res, next) ->
  logger.log 'info', 'GET ' + req.originalUrl
  getHandler.handleRequest req, (err, response) ->
    sendResponse res, err, responses

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
    logger.log 'error', err
    res.status err.status or 500
    res.json err.statusText
    logger.log 'error', err.statusText
  else
    res.status 200
    res.json JSON.parse response
    logger.log 'info', 'RESPONSE 200'

# Expose router
module.exports = router
