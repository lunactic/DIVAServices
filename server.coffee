# Server
# ======
# **Server** is the main entry point for running the DIVAServices Spotlight application. DIVAServices Spotlight
# is running on an [nodeJS](https://nodejs.org/) plattform and uses the [Express](http://expressjs.com/)
# framework.
# Copyright &copy; Marcel Würsch, GPL v3.0 Licensed.


if not process.env.NODE_ENV? or process.env.NODE_ENV not in ['dev', 'test', 'prod']
  console.log 'please set NODE_ENV to [dev, test, prod]. going to exit'
  process.exit 0


nconf = require 'nconf'
nconf.add 'server', type: 'file', file: './conf/server.' + process.env.NODE_ENV + '.json'

bodyParser    = require 'body-parser'
cookieParser  = require 'cookie-parser'
express       = require 'express'
favicon       = require 'serve-favicon'
http          = require 'http'
logger        = require './app/logging/logger'
router        = require './app/routes/router'
sysPath       = require 'path'
Statistics    = require './app/statistics/statistics'

#setup express framework
app = express()

#shutdown handler
process.on 'SIGTERM', () ->
  logger.log 'info', 'RECEIVED SIGTERM'
  Statistics.saveStatistics () ->
    process.exit(0)


#setup body parser
app.use bodyParser.json(limit: '50mb')
app.use bodyParser.urlencoded(extended: true, limit: '50mb')

#setup static file handler
app.use '/static', express.static('/data/images')


#favicon
app.use favicon(__dirname + '/images/favicon/favicon.ico')

#setup routes
app.use router
server = http.createServer app
#server.timeout = 12000

server.listen nconf.get('server:port'), ->
  Statistics.loadStatistics()
  logger.log 'info', 'Server listening on port ' + nconf.get 'server:port'
