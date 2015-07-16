do ->
  'use strict'

fs          = require 'fs'
imageHelper = require '../helper/imageHelper'
executableHelper = require '../helper/executableHelper'

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
          console.log 'Command execution failed. Error: ' + err
          res.sendStatus 500
          res.body = err
        else
          console.log 'Command execution successful. Return message: ' + result
          res.json JSON.parse(result)

module.exports = PostHandler
