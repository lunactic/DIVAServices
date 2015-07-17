# Server
# ======
#
# Copyright &copy; Marcel Würsch, GPL v3.0 Licensed.

nconf = require 'nconf'
nconf.add 'server', type: 'file', file: './conf/server.' + process.env.NODE_ENV + '.json'

express       = require 'express'
#favicon       = require 'serve-favicon'
cookieParser  = require 'cookie-parser'
bodyParser    = require 'body-parser'
sysPath       = require 'path'
http          = require 'http'
router        = require './app/routes/router'


#setup express framework
app = express()

#setup body parser
app.use bodyParser.json(limit: '50mb')
app.use bodyParser.urlencoded(extended: true, limit: '50mb')

#setup routes
app.use router

#start server on port specified in configuration file
server = http.createServer app
#server.timeout = 12000

server.listen 8080, ->
  console.log 'Server listening on port ' + nconf.get 'server:port'
