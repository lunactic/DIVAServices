# Router
# =======
#
# **Router** uses the [Express > Router](http://expressjs.com/api.html#router) middleware
# for handling all routing from DIVAServices Spotlight.
#
# Copyright &copy; Michael Bärtschi, MIT Licensed.

# Require Express Router
router      = require('express').Router()
getHandler  = require('./getHandler')
postHandler = require('./postHandler')
logger      = require('../logging/logger')


getHandle = new getHandler()
postHandle = new postHandler()
# Pass Express Router to all routing modules
router.get '*', (req, res, next) ->
  logger.log 'info', 'GET ' + req.originalUrl
  getHandle.handleRequest req, res, (err, response) ->
    sendResponse res, err, response, next
router.post '*', (req, res, next) ->
  logger.log 'info', 'POST ' + req.originalUrl
  postHandle.handleRequest req, res, (err, response) ->
    sendResponse res, err, response, next

sendResponse = (res, err, response, next) ->
  if err?
    logger.log 'error', err
    res.status err.status or 500
    res.json err.statusText
    logger.log 'error', err.statusText
  else
    res.status 200
    res.json JSON.parse response
    logger.log 'info', 'RESPONSE 200'
  next()
# Expose router
module.exports = router
