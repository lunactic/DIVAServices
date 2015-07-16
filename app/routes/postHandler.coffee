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
      ioHelper = new ioHelper()

      #extract image
      imagePath = imgHelper.saveImage req.body.image
      #perform parameter matching
      neededParameters = arrayFound[0].parameters
      inputParameters = req.body.inputs
      programType = arrayFound[0].programType
      #fill executable path with parameter values
      command = exHelper.buildExecutablePath req, imagePath, arrayFound[0].executablePath, inputParameters, neededParameters, programType

      #executeCommand is an asynchronous function
      response = exHelper.executeCommand command, (err, result) ->
        if err?
          #console.log 'Command execution failed. Error: ' + err
          res.sendStatus 500
          res.body = err
        else
          #save result
          ioHelper.saveResult imgHelper.imgFolder, req.originalUrl, exHelper.params, result
          res.json JSON.parse(result)

module.exports = PostHandler
