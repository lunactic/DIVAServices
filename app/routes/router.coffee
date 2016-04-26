# Router
# =======
#
# **Router** uses the [Express > Router](http://expressjs.com/api.html#router) middleware
# for handling all routing from DIVAServices.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Require Express Router
AlgorithmManagement = require '../management/algorithmManagement'
async = require 'async'
DockerManagement = require '../docker/dockerManagement'
GetHandler = require './getHandler'
ImageHelper = require '../helper/imageHelper'
IoHelper = require '../helper/ioHelper'
logger = require '../logging/logger'
nconf = require 'nconf'
path = require 'path'
PostHandler = require './postHandler'
ResultHelper = require '../helper/resultHelper'
router = require('express').Router()
schemaValidator = require '../validator/schemaValidator'
Statistics = require '../statistics/statistics'
Upload = require '../upload/upload'


getHandler = new GetHandler()
postHandler = new PostHandler()

# Set up special route for image uploading
router.post '/upload', (req, res) ->
  if(req.body.image?)
    Upload.uploadBase64Image req.body.image, (err, result) ->
      res.json {md5: result.md5}
  else if(req.body.zip?)
    Upload.uploadBase64Zip req.body.zip, (err, result) ->
      res.json {collection: result}
  else if(req.body.url?)
    if(req.body.url.endsWith('zip'))
      Upload.uploadZip(req.body.url, (err, result) ->
        res.json {collection: result}
      )
    else
      Upload.uploadUrl req.body.url, (err, result) ->
        res.json {md5: result.md5}

router.post '/jobs/:jobId', (req, res, next) ->
  process = Statistics.getProcess(req.params.jobId)
  Statistics.endRecording(req.params.jobId, process.req.originalUrl)
  async.waterfall [
    (callback) ->
      process.result = req.body
      ResultHelper.saveResult(process, callback)
    (callback) ->
      process.resultHandler.handleResult(null, null, null, process, (error, data, processId) ->
        callback null
      )
  ], (err) ->
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

router.post '/algorithms', (req, res, next) ->
  ioHelper = new IoHelper()
  #add a new algorithm
  #get route address
  schemaValidator.validate(req.body, 'createSchema', (error) ->
    if(error)
      sendError(res, error)
    else
      #docker
      route = AlgorithmManagement.generateUrl(req.body)
      identifier = AlgorithmManagement.createIdentifier()
      AlgorithmManagement.updateStatus(identifier,'creating')
      AlgorithmManagement.generateFolders(route)
      ioHelper.downloadFile(req.body.file, '/data/executables/'+route, (err, filename) ->
        #create docker file
        DockerManagement.createDockerFile(req.body, '/data/executables/'+route)
        #create bash script
        DockerManagement.createBashScript(req.body, '/data/executables/'+route)
        #update servicesFile
        AlgorithmManagement.createInfoFile(req.body, '/data/json/'+route)
        AlgorithmManagement.updateServicesFile(req.body, route)
        AlgorithmManagement.updateRootInfoFile(req.body, route)
        #create a tar from zip
        DockerManagement.buildImage('/data/executables/'+route, req.body.image_name, (err, response) ->
          if(err?)
            #return error message
          else
            AlgorithmManagement.updateStatus(identifier,'ok')
            response =
              statusCode: 200
              identifier: identifier
              message: 'Algorithm created'
            sendResponse(res, response)
        ))
      )

# Set up the routing for POST requests
router.post '*', (req, res, next) ->
  postHandler.handleRequest req, (err, response) ->
    response['statusCode'] = 202
    sendResponse res, err, response


router.get '/algorithms/:identifier', (req, res) ->
  identifier = req.params.identifier
  status = AlgorithmManagement.getStatus(identifier)
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
  ioHelper = new IoHelper()
  filename = ioHelper.zipFolder(nconf.get('paths:imageRootPath') + '/' + req.params.collection + '/' + req.params.execution)
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
router.get '/info/inputs', (req, res) ->
  ioHelper = new IoHelper()
  inputs = ioHelper.loadFile('conf/algorithmInputs.json')

  sendResponse res, null, inputs

router.get '/info/outputs', (req, res) ->
  ioHelper = new IoHelper()
  outputs = ioHelper.loadFile('conf/algorithmOutputs.json')
  sendResponse res, null, outputs,

router.get '/info/general', (req, res) ->
  ioHelper = new IoHelper()
  general = ioHelper.loadFile('conf/generalAlgorithmInfos.json')
  sendResponse res, null, general

router.get '/info/additional', (req, res) ->
  ioHelper = new IoHelper()
  additional = ioHelper.loadFile('conf/additionalAlgorithmInfos.json')
  sendResponse res, null, additional

router.get '/info/environments', (req, res) ->
  ioHelper = new IoHelper()
  environments = ioHelper.loadFile('conf/algorithmEnvironments.json')
  sendResponse res, null, environments

router.get '/info/language', (req, res) ->
  ioHelper = new IoHelper()
  languages = ioHelper.loadFile('conf/algorithmLanguages.json')
  sendResponse res, null, languages

# Set up the routing for GET requests
router.get '*', (req, res, next) ->
  getHandler.handleRequest req, (err, response) ->
    sendResponse res, err, response


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
    res.json JSON.parse(response)
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
