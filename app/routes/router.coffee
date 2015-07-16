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
router.get '*', (req, res) ->
  getHandle.handleRequest req, res
router.post '*', (req, res) ->
  postHandle.handleRequest req, res

# Expose router
module.exports = router
