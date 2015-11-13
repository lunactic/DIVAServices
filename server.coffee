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

async		          = require 'async'
bodyParser        = require 'body-parser'
cookieParser      = require 'cookie-parser'
express           = require 'express'
fs                = require 'fs'
favicon           = require 'serve-favicon'
http              = require 'http'
logger            = require './app/logging/logger'
morgan            = require 'morgan'
router            = require './app/routes/router'
sysPath           = require 'path'
Statistics        = require './app/statistics/statistics'
ImageHelper       = require './app/helper/imageHelper'
ExecutableHelper  = require './app/helper/executableHelper'
IoHelper          = require './app/helper/ioHelper'
ConsoleResultHandler = require './app/helper/resultHandlers/consoleResultHandler'

#setup express framework
app = express()

#HTTPS settings
#privateKey = fs.readFileSync('/data/express.key','utf8')
#certificate = fs.readFileSync('/data/express.crt','utf8')

#credentials = {key: privateKey, cert: certificate}

#shutdown handler
process.on 'SIGTERM', () ->
  logger.log 'info', 'RECEIVED SIGTERM'
  Statistics.saveStatistics () ->
    process.exit(0)

#add headers
app.use (req,res,next) ->
  #res.setHeader 'Access-Control-Allow-Origin', '*'
  res.setHeader 'Access-Control-Allow-Methods', 'GET,POST,OPTIONS'
  res.setHeader 'Access-Control-Allow-Headers', 'Origin, X-Requested-With,content-type, Accept'
  res.setHeader 'Access-Control-Allow-Credentials', false
  next()

#setup body parser
app.use bodyParser.json(limit: '50mb')
app.use bodyParser.urlencoded(extended: true, limit: '50mb')

#setup static file handler
app.use '/static', express.static('/data/images')

accessLogStream = fs.createWriteStream(__dirname + '/logs/access.log',{flgas:'a'})
#favicon
app.use favicon(__dirname + '/images/favicon/favicon.ico')
#handle gabor post request seperately
app.post '/segmentation/textline/gabor*', (req, res) ->
  imageHelper = new ImageHelper()
  executableHelper = new ExecutableHelper()
  ioHelper = new IoHelper()
  resultHelper = new ConsoleResultHandler(null)
  if(req.originalUrl.indexOf('merge') > -1)
    command = 'java -Djava.awt.headless=true -jar /data/executables/gabortextlinesegmentation/gabortextlinesegmentation.jar merge ' + req.body.mergePolygon1 + ' ' + req.body.mergePolygon2
    console.log 'result Helper: ' + resultHelper
    executableHelper.executeCommand command, resultHelper,null, (err, data, statIdentifier, fromDisk, callback) ->
      res.status 200
      res.json JSON.parse data
      logger.log 'info', 'RESPONSE 200'
  else if (req.originalUrl.indexOf('split') > -1)
    command = 'java -Djava.awt.headless=true -jar /data/executables/gabortextlinesegmentation/gabortextlinesegmentation.jar split ' + req.body.splitPolygon + ' ' + req.body.xSplit + ' ' + req.body.ySplit
    executableHelper.executeCommand command, resultHelper,null, (err, data, statIdentifier, fromDisk, callback) ->
      res.status 200
      res.json JSON.parse data
      logger.log 'info', 'RESPONSE 200'
  else if (req.originalUrl.indexOf('erase') > -1)
    command = 'java -Djava.awt.headless=true -jar /data/executables/gabortextlinesegmentation/gabortextlinesegmentation.jar delete ' + req.body.erasePolygon + ' ' + req.body.xErase + ' ' + req.body.yErase
    executableHelper.executeCommand command, resultHelper,null, (err, data, statIdentifier, fromDisk, callback) ->
      res.status 200
      res.json JSON.parse data
      logger.log 'info', 'RESPONSE 200'
  else
    async.waterfall [
      (callback) ->
        if(req.body.url?)
          imageHelper.saveImageUrl(req.body.url, callback)
        else if(req.body.image?)
          imageHelper.saveImage(req.body.image,callback)
        return
      #perform parameter matching
      (result, callback) ->
        @params = []
        @imagePath = result.path
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
        ioHelper.loadResult(imageHelper.imgFolder, req.originalUrl, @params,true, callback)
        return
      (data, callback) ->
        if(data?)
          callback null, data, -1, true
        else
          #fill executable path with parameter values
          #command = executableHelper.buildCommand(arrayFound[0].executablePath, @inputParameters, @neededParameters, @programType)
          command = 'java -Djava.awt.headless=true -jar /data/executables/gabortextlinesegmentation/gabortextlinesegmentation.jar create ' + @imagePath + ' input ' + nconf.get('paths:matlabScriptsPath') + ' ' + nconf.get('paths:matlabPath') + ' ' + @top + ' ' + @bottom + ' ' + @left + ' ' + @right + ' ' + @linkingRectWidth + ' ' + @linkingRectHeight
          resultHelper = new ConsoleResultHandler(null)
          executableHelper.executeCommand(command,resultHelper, null, null, callback)
        return
      (data, statIdentifier, fromDisk, callback) ->
        if(fromDisk)
          callback null, data
        #save the response
        else
          filePath = ioHelper.buildFilePath(imageHelper.imgFolder, req.originalUrl, @params)
          ioHelper.saveResult(filePath, data, callback)
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
          console.log 'result: ' + JSON.parse results
          res.json JSON.parse results
          logger.log 'info', 'RESPONSE 200'


#setup routes
app.use router
server = http.createServer app
#server.timeout = 12000
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
