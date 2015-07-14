# Server
# ======
#
# **Server** is the main entry point for running the DIVAServices Spotlight application. DIVAServices Spotlight
# is running on an [nodeJS](https://nodejs.org/) plattform and uses the [Express](http://expressjs.com/)
# framework.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 Licensed.


# Set the `NODE_ENV` environment variable to `dev`, `test`, or `prod` depending on whether you are
# in development mode, in testing mode, or in production mode
if not process.env.NODE_ENV? or process.env.NODE_ENV not in ['dev', 'test', 'prod']
  console.log 'please set NODE_ENV to [dev, test, prod]. going to exit'
  process.exit 0

nconf = require 'nconf'
nconf.add 'server', type: 'file', file: './conf/server' + process.env.NODE_ENV + '.json'

express       = require 'express'
favicon       = require 'serve-favicon'
cookieParser  = require 'cookie-parser'
bodyParser    = require 'body-parser'
sysPath       = require 'path'
http          = require 'http'
getHandler    = require './app/routes/getHandler'
postHandler   = require './app/routes/postHandler'

getRequestHandler = new getHandler()
postRequestHandler = new postHandler()

#expose 'server'
server = exports = module.exports = {}

#Export 'startServer' function which is used by [Brunch]{http://brunch.io}
server.startServer = (port, path, callback) ->
  #setup express framework
  app = express()

  #Wrap 'express' with 'httpServer' for 'socket.io'
  app.server = http.createServer app

  #Set server timeout to value specified in configuration file
  app.server.timeout = nconf.get 'server:timeout'

  # Route all static files to http paths
  app.use '', express.static sysPath.resolve path

  # uncomment after placing your favicon in /public
  #app.use(favicon(__dirname + '/public/favicon.ico'));
  #app.use logger('dev')

  #setup body parser
  app.use bodyParser.json()
  app.use bodyParser.urlencoded(extended: true)


  #setup routes
  app.use (req, res, next) ->
    if req.method == 'GET'
      getRequestHandler.handleRequest req, res, next
    else if req.method == 'POST'
      postRequestHandler.handleRequest req, res, next
    return

  #start server on port specified in configuration file
  app.server.listen port, callback
