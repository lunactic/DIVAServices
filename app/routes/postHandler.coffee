fs                = require 'fs'
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
      imgHelper.saveImage req.body.image, (error, imagePath) ->
        console.log "imagePath: " + imagePath

        neededParameters = arrayFound[0].parameters
        inputParameters = req.body.inputs
        programType = arrayFound[0].programType
        #perform parameter matching
        exHelper.matchParams imagePath, inputParameters,neededParameters

        #try to load results from disk
        retVal = null
        ioHelp.loadResult imgHelper.imgFolder, req.originalUrl, exHelper.params, (err, data) ->
          if err?
            console.log 'error: ' + err
          else
            console.log 'return data from disk'
            retVal = JSON.parse(data)
            return
      
        #fill executable path with parameter values
        command = exHelper.buildExecutablePath req, arrayFound[0].executablePath, inputParameters, neededParameters, programType

        #executeCommand is an asynchronous function
        response = exHelper.executeCommand command, (err, result) ->
          if err?
            console.log 'Command execution failed. Error: ' + err
            res.sendStatus 500
            res.body = err
          else
            console.log 'return data after computing'
            #save result
            ioHelp.saveResult imgHelper.imgFolder, req.originalUrl, exHelper.params, result
            res.json JSON.parse(result)
          return
module.exports = PostHandler
