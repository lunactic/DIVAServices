fs          = require 'fs'
imageHelper = require '../helper/imageHelper'

class PostHandler

  getParamValue = (parameter, inputParameters) ->
    if inputParameters.hasOwnProperty(parameter)
      return inputParameters[parameter]
    return

  ### Handle Incoming GET Requests ###
  handleRequest: (req, res, next) ->
    fileContent = JSON.parse(fs.readFileSync('/data/json/services.json', 'utf8'))
    arrayFound = fileContent.services.filter((item) ->
      item.path == req.originalUrl
    )
    if typeof arrayFound != 'undefined'
      #extract image
      imgHelper = new imageHelper()
      imgHelper.saveImage req.body.image
      #perform parameter matching
      console.log req.body
      neededParameters = arrayFound[0].parameters
      inputParameters = req.body.inputs
      executablePath = arrayFound[0].executablePath
      #loop through all needed parameters
      for parameter of neededParameters
        #find matching input parameter
        value = getParamValue(parameter, inputParameters)
        if typeof value != 'undefined'
          executablePath += ' ' + value
      console.log executablePath
      res.sendStatus 200
    next()
    return

module.exports = PostHandler
