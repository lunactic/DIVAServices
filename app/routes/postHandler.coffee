fs                = require 'fs'
async             = require 'async'
imageHelper       = require '../helper/imageHelper'
executableHelper  = require '../helper/executableHelper'
ioHelper          = require '../helper/ioHelper'
class PostHandler

  ### Handle Incoming GET Requests ###
  handleRequest: (req, res) ->
    fileContent = JSON.parse(fs.readFileSync('/data/json/services.json', 'utf8'))
    arrayFound = fileContent.services.filter((item) ->
      item.path == req.originalUrl
    )
    if typeof arrayFound != 'undefined'
      imgHelper = new imageHelper()
      exHelper = new executableHelper()
      ioHelp = new ioHelper()
      #extract image
      async.waterfall [
        #save image
        (callback) ->
          imgHelper.saveImage req.body.image, callback
          return
        #perform parameter matching
        (imagePath, callback) ->
          @neededParameters = arrayFound[0].parameters
          @inputParameters = req.body.inputs
          @programType = arrayFound[0].programType
          result = exHelper.matchParams imagePath, inputParameters,neededParameters
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
        ], (err, results) ->
          if err?
            console.log 'Command execution failed. Error: ' + err
            res.sendStatus 500
            res.body = err
          else
            console.log 'return data after computing'
            console.log results
            #save result
            ioHelp.saveResult imgHelper.imgFolder, req.originalUrl, exHelper.params, results
            #return result
            res.json JSON.parse(results)
        return
module.exports = PostHandler
