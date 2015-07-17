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

getHandle = new getHandler()
postHandle = new postHandler()
# Pass Express Router to all routing modules
router.get '*', (req, res, next) ->
  getHandle.handleRequest req, res, (err, response) ->
    sendResponse res, err, response, next
router.post '*', (req, res, next) ->
  postHandle.handleRequest req, res, (err, response) ->
    sendResponse res, err, response, next

sendResponse = (res, err, response, next) ->
  console.log 'sending response!'
  if err?
    console.log 'error: ' + err
    res.status err.status or 500
    res.json err.statusText
  else
    res.status 200
    res.json JSON.parse response
  next()
# Expose router
module.exports = router
