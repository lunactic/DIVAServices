do ->
  'use strict'

fs          = require 'fs'
imageHelper = require '../helper/imageHelper'
executableHelper = require '../helper/executableHelper'

class PostHandler

  ### Handle Incoming GET Requests ###
  handleRequest: (req, res, next) ->
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
      #fill executable path with parameter values
      command = exHelper.buildExecutablePath req, imagePath, arrayFound[0].executablePath, inputParameters, neededParameters

      response = exHelper.executeCommand command
      #console.log executablePath
      res.sendStatus 200
      res.body = response
    next
    return

module.exports = PostHandler
