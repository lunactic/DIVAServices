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

async             = require 'async'
express       = require 'express'
#favicon       = require 'serve-favicon'
cookieParser  = require 'cookie-parser'
bodyParser    = require 'body-parser'
sysPath       = require 'path'
http          = require 'http'
router        = require './app/routes/router'
logger        = require './app/logging/logger'
Statistics    = require './app/statistics/statistics'
ImageHelper   = require './app/helper/imageHelper'
ExecutableHelper = require './app/helper/executableHelper'
IoHelper      = require './app/helper/ioHelper'
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

#handle gabor post request seperately
app.post '/segmentation/textline/gabor', (req, res) ->
  imageHelper = new ImageHelper()
  executableHelper = new ExecutableHelper()
  ioHelper = new IoHelper()
  async.waterfall [
    (callback) ->
      imageHelper.saveImageUrl(req.body.url, callback)
      return
    #perform parameter matching
    (imagePath, callback) ->
      console.log 'imgHelper.imgFolder: ' + imageHelper.imgFolder
      @params = []
      @imagePath = imagePath
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
      ioHelper.loadResult(imageHelper.imgFolder, req.originalUrl, @params, callback)
      return
    (data, callback) ->
      if(data?)
        callback null, data, -1, true
      else
        #fill executable path with parameter values
        #command = executableHelper.buildCommand(arrayFound[0].executablePath, @inputParameters, @neededParameters, @programType)
        command = 'java -jar /data/executables/gabortextlinesegmentation/gabortextlinesegmentation.jar create ' + @imagePath + ' input ' + nconf.get('paths:matlabScriptsPath') + ' ' + nconf.get('paths:matlabPath') + ' ' + @top + ' ' + @bottom + ' ' + @left + ' ' + @right + ' ' + @linkingRectWidth + ' ' + @linkingRectHeight
        executableHelper.executeCommand(command, null, callback)
      return
    (data, statIdentifier, fromDisk, callback) ->
      if(fromDisk)
        callback null, data
      #save the response
      else
        ioHelper.saveResult(imageHelper.imgFolder, req.originalUrl, @params, data, callback)
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
        res.json response
        logger.log 'info', 'RESPONSE 200'

#add headers
app.use (req,res,next) ->
  res.setHeader 'Access-Control-Allow-Origin', 'http://diuf.unifr.ch'
  res.setHeader 'Access-Control-Allow-Methods', 'GET,POST,OPTIONS'
  res.setHeader 'Access-Control-Allow-Headers', 'X-Requested-With,content-type'
  res.setHeader 'Access-Control-Allow-Credentials', false
  next()


#setup routes
app.use router

#start server on port specified in configuration file
server = http.createServer app
#server.timeout = 12000

server.listen nconf.get('server:port'), ->
  Statistics.loadStatistics()
  logger.log 'info', 'Server listening on port ' + nconf.get 'server:port'
