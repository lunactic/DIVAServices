# Router
# =======
#
# **Router** uses the [Express > Router](http://expressjs.com/api.html#router) middleware
# for handling all routing from DIVAServices.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Require Express Router
AlgorithmManagement = require '../management/algorithmManagement'
async               = require 'async'
GetHandler          = require './getHandler'
IiifManifestParser  = require '../parsers/iiifManifestParser'
ImageHelper         = require '../helper/imageHelper'
IoHelper            = require '../helper/ioHelper'
logger              = require '../logging/logger'
nconf               = require 'nconf'
path                = require 'path'
PostHandler         = require './postHandler'
RandomWordGenerator = require '../randomizer/randomWordGenerator'
ResultHelper        = require '../helper/resultHelper'
router              = require('express').Router()
schemaValidator     = require '../validator/schemaValidator'
Statistics          = require '../statistics/statistics'


getHandler = new GetHandler()
postHandler = new PostHandler()

# Set up special route for image uploading
#TODO Provide a way to upload other data (currently sent as req.body.data)
router.post '/upload', (req, res) ->
  collectionName = RandomWordGenerator.generateRandomWord()
  IoHelper.createCollectionFolders(collectionName)
  process =
    rootFolder: collectionName
  #send immediate response with collection name to not block the request for too long
  
  #Create a status route
  numberOfImages = 0
  async.each req.body.images, ((image, callback) ->
    switch image.type
      when 'iiif'
        iifManifestParser = new IiifManifestParser(image.value)
        iifManifestParser.initialize().then ->
          numberOfImages += iifManifestParser.getAllImages(0).length
          console.log numberOfImages
          callback()
      else
        numberOfImages++
        callback()
  ), (err) ->
    console.log 'all images processed'
    ImageHelper.createCollectionInformation(collectionName, numberOfImages)
    send200(res, {collection: collectionName})
    imageCounter = 1
    for image, i in req.body.images
      switch image.type
        when 'iiif'
          iifManifestParser = new IiifManifestParser(image.value)
          iifManifestParser.initialize().then ->
            #TODO improve to save all images
            images = iifManifestParser.getAllImages(0)
            metadata = iifManifestParser.getMetadata()
            label = iifManifestParser.getLabel()
            description = iifManifestParser.getDescription()
            for inputImage,i in images
              ImageHelper.saveImageUrl(inputImage, collectionName, i, (image) ->
                ImageHelper.addImageInfo image.md5, image.path, collectionName
                ImageHelper.updateCollectionInformation(collectionName, numberOfImages, imageCounter++)
              )
        else
          ImageHelper.saveImage(image, process, numberOfImages, imageCounter++)

router.post '/jobs/:jobId', (req, res, next) ->
  logger.log 'info', 'jobs route called'
  process = Statistics.getProcess(req.params.jobId)
  Statistics.endRecording(req.params.jobId, process.req.originalUrl)
  async.waterfall [
    (callback) ->
      process.result = req.body
      ResultHelper.saveResult(process, callback)
      return
    (callback) ->
      process.resultHandler.handleResult(null, null, null, process, (error, data, processId) ->
        if(error)
          callback error
        else
          callback null
        return
      )
  ], (err) ->
    if(err)
      AlgorithmManagement.updateStatus(null, 'error', process.req.originalUrl, error.statusMessage)
      sendError(res, err)
    else if(process.type is 'test')
      schemaValidator.validate(IoHelper.loadFile(process.resultFile), 'responseSchema', (error) ->
        if error
          AlgorithmManagement.updateStatus(null, 'error', process.req.originalUrl, error.statusText)
          ResultHelper.removeResult(process)
          sendError(res, error)
        else
          AlgorithmManagement.updateStatus(null, 'ok', process.req.originalUrl)
          ResultHelper.removeResult(process)
          send200(res, {status: 'valid'})
      )
    else
      res.status '200'
      res.send()

router.post '/validate/:schema', (req, res, next) ->
  switch req.params.schema
    when 'host'
      validate(req, res, 'hostSchema')
    when 'hostAlgorithm'
      validate(req, res, 'algorithmSchema')
    when 'response'
      validate(req, res, 'responseSchema')
    when 'detailsAlgorithm'
      validate(req, res, 'detailsAlgorithmSchema')
    when 'create'
      validate(req, res, 'createSchema')

# Set up the routing for POST requests
router.post '*', (req, res, next) ->
  if(unlike(req, '/algorithms'))
    postHandler.handleRequest req, (err, response) ->
      if(!err)
        response['statusCode'] = 202
      sendResponse res, err, response
  else
    next()

#read status information of a collection
router.get '/collections/:collection', (req, res) ->
  collection = req.params.collection
  status = ImageHelper.getCollectionInformation(collection)
  send200(res, status)

#load all images from a collection
router.get '/image/:collection', (req, res) ->
  collection = req.params.collection
  images = ImageHelper.loadCollection(collection, false)
  imgs = []
  for image in images
    imgs.push('image': {
      md5: image.md5
      url: ImageHelper.getOutputImageUrl(collection + path.sep + 'original', image.name, image.extension)
    })
  response =
    collection: collection
    images: imgs
  sendResponse(res, null, response)

router.get '/image/check/:md5', (req, res) ->
  ImageHelper.imageExists req.params.md5, (err, response) ->
    sendResponse res, err, response

router.get '/collections/:collection/:execution', (req, res) ->
#zip folder
  filename = IoHelper.zipFolder(nconf.get('paths:imageRootPath') + '/' + req.params.collection + '/' + req.params.execution)
  res.status '200'
  res.json ({zipLink: 'http://' + nconf.get('server:rootUrl') + '/static/' + filename})

router.get '/image/results/:md5', (req, res)->
  ImageHelper.imageExists req.params.md5, (err, response) ->
    if(response.imageAvailable)
      response = ResultHelper.loadResultsForMd5(req.params.md5)
    else
      err =
        statusCode: 404
        statusText: 'This result is not available'

    sendResponse res, err, response



#Info routes
router.get '/information/general', (req, res) ->
  general = IoHelper.loadFile('conf/algorithmGeneral.json')
  sendResponse res, null, general

router.get '/information/input', (req, res) ->
  input = IoHelper.loadFile('conf/algorithmInput.json')
  sendResponse res, null, input

router.get '/information/output', (req, res) ->
  output = IoHelper.loadFile('conf/algorithmOutput.json')
  sendResponse res, null, output

router.get '/information/method', (req, res) ->
  method = IoHelper.loadFile('conf/algorithmMethod.json')
  sendResponse res, null, method

# Set up the routing for GET requests
router.get '*', (req, res, next) ->
  if(unlike(req, '/algorithms'))
    getHandler.handleRequest req, (err, response) ->
      sendResponse res, err, response
  else
    next()


unlike = (req, path) ->
  if(req.path.contains(path))
    false
  else
    true
# ---
# **sendResponse**</br>
# Send response back to the caller </br>
# `params`
#   *res* response object from the express framework
#   *err* possible error message. If set a HTTP 500 will be returned
#   *response* the JSON response. If set a HTTP 200 will be returned
sendResponse = (res, err, response) ->
  if(err?)
    sendError(res, err)
  else
    sendWithStatus(res, response)


send200 = (res, response) ->
  res.status = 200
  try
    res.json JSON.parse(response)
  catch error
    res.json response


sendWithStatus = (res, response) ->
  res.status response.statusCode or 200
  #parse an unparsed json string to get a correct response
  try
    response = JSON.parse(response)
    res.json response
  catch error
    res.json response

sendError = (res, err) ->
  res.status err.statusCode or 500
  error =
    status: err.statusCode
    type: err.errorType
    message: err.statusText
  res.json error

validate = (req, res, schema) ->
  schemaValidator.validate(req.body, schema, (error) ->
    if error
      sendError(res, error)
    else
      send200(res, {status: 'valid'})
  )

# Expose router
module.exports = router
