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
nconf.add 'detailsAlgorithmSchema', type: 'file', file: './conf/schemas/detailsAlgorithmSchema.json'
nconf.add 'generalAlgorithmSchema', type: 'file', file: './conf/schemas/generalAlgorithmSchema.json'
nconf.add 'hostSchema', type: 'file', file: './conf/schemas/hostSchema.json'
nconf.add 'responseSchema', type: 'file', file: './conf/schemas/responseSchema.json'

bodyParser    = require 'body-parser'
express       = require 'express'
favicon       = require 'serve-favicon'
fs            = require 'fs'
http          = require 'http'
https         = require 'https'
morgan        = require 'morgan'
logger        = require './app/logging/logger'
router        = require './app/routes/router'
Statistics    = require './app/statistics/statistics'
ImageHelper   = require './app/helper/imageHelper'

#setup express framework
app = express()

#HTTPS settings
#privateKey = fs.readFileSync('/data/express.key','utf8')
#certificate = fs.readFileSync('/data/express.crt','utf8')

#credentials = {key: privateKey, cert: certificate}

#shutdown handler
process.on 'SIGTERM', () ->
  logger.log 'info', 'RECEIVED SIGTERM'
  Statistics.saveStatistics()
  ImageHelper.saveImageInfo()
  process.exit(0)

#setup body parser
app.use bodyParser.json(limit: '50mb')
app.use bodyParser.urlencoded(extended: true, limit: '50mb')

#setup static file handler
app.use '/static', express.static('/data/images')

accessLogStream = fs.createWriteStream(__dirname + '/logs/access.log',{flags:'a'})
#favicon
app.use favicon(__dirname + '/images/favicon/favicon.ico')
app.use(morgan('combined',{stream: accessLogStream}))
#setup routes
app.use router

#httpsServer = https.createServer(credentials,app)
httpServer = http.createServer(app)

httpServer.timeout = nconf.get('server:timeout')
#httpsServer.timeout = nconf.get('server:timeout')

httpServer.listen nconf.get('server:httpPort'), ->
  Statistics.loadStatistics()
  logger.log 'info', 'HTTP Server listening on port ' + nconf.get 'server:httpPort'

#httpsServer.listen nconf.get('server:httpsPort'), ->
#  logger.log 'info', 'HTTPS Server listening on port ' + nconf.get 'server:httpsPort'
