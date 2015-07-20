fs                = require 'fs'
async             = require 'async'
imageHelper       = require '../helper/imageHelper'
executableHelper  = require '../helper/executableHelper'
ioHelper          = require '../helper/ioHelper'
class PostHandler

  ### Handle Incoming GET Requests ###
  handleRequest: (req, res, cb) ->
    fileContent = JSON.parse(fs.readFileSync('/data/json/services.json', 'utf8'))
    arrayFound = fileContent.services.filter((item) ->
      item.path == req.originalUrl
    )
    if typeof arrayFound != 'undefined'
      imgHelper = new imageHelper()
      exHelper = new executableHelper()
      ioHelp = new ioHelper()

      ###
        perform all the steps using an async waterfall
        Each part will be executed and the response is passed on to the next
        function.
      ###
      async.waterfall [
        #save image
        (callback) ->
          imgHelper.saveImage req.body.image, callback
          return
        #perform parameter matching
        (imagePath, callback) ->
          @imagePath = imagePath
          @neededParameters = arrayFound[0].parameters
          @inputParameters = req.body.inputs
          @inputHighlighters = req.body.highlighter
          @programType = arrayFound[0].programType
          console.log 'Request body: ' + JSON.stringify(@inputHighlighters)
          exHelper.matchParams @imagePath, @inputParameters, @inputHighlighters,@neededParameters, callback
          callback null
          return

        #try to load results from disk
        (callback) ->
          ioHelp.loadResult imgHelper.imgFolder, req.originalUrl, exHelper.params, callback
          return
        #execute method if not loaded
        (data, callback) ->
          if(data?)
            callback null, data
          else
            #fill executable path with parameter values
            command = exHelper.buildExecutablePath req, arrayFound[0].executablePath, @inputParameters, @neededParameters, @programType
            exHelper.executeCommand command, callback
          return
        #save the response
        (data, callback) ->
          ioHelp.saveResult imgHelper.imgFolder, req.originalUrl, exHelper.params, data
          callback null, data
        #finall callback, handling of the result and returning it
        ], (err, results) ->
          cb err, results
        return
module.exports = PostHandler
