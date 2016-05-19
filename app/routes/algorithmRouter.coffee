AlgorithmManagement   = require '../management/algorithmManagement'
async                 = require 'async'
DockerManagement      = require '../docker/dockerManagement'
ExecutableHelper      = require '../helper/executableHelper'
IoHelper              = require '../helper/ioHelper'
logger                = require '../logging/logger'
nconf                 = require 'nconf'
path                  = require 'path'
ProcessingQueue       = require '../processingQueue/processingQueue'
router                = require('express').Router()
schemaValidator       = require '../validator/schemaValidator'
ServicesInfoHelper = require '../helper/servicesInfoHelper'


router.get '/algorithms/:identifier', (req, res) ->
  identifier = req.params.identifier
  status = AlgorithmManagement.getStatusByIdentifier(identifier)
  if(not status?)
    err =
      statusCode: 404,
      statusText: 'Algorithm with ' + identifier + ' not available'
    sendError(res, err)
  else
    send200 res, status

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
      #check if we can find the route already
      status = AlgorithmManagement.getStatusByRoute('/' + route)
      imageName = AlgorithmManagement.generateImageName(req.body)
      if(status?)
        if(status.status.statusCode == 410)
          createAlgorithm(req,res, route, identifier, imageName)
        else
          response =
            statusCode: status.status.statusCode
            identifier: status.identifier
            statusMessage: status.status.statusMessage
          sendResponse res, null, response
      else
        identifier = AlgorithmManagement.createIdentifier()
        AlgorithmManagement.generateFolders(route)
        createAlgorithm(req,res, route, identifier, imageName)
  )

router.put '/algorithms/:identifier', (req, res) ->
  #perform a deletion and an addition of the new algorithm
  serviceInfo = ServicesInfoHelper.getServiceInfoByIdentifier(req.params.identifier)
  if(serviceInfo?)
    #build new route
    currentRoute = serviceInfo.path
    routeParts = currentRoute.split('/')
    lastPart = routeParts[routeParts.length - 1]
    if(isNaN(lastPart))
      newRoute = currentRoute + '/1'
    else
      routeParts[routeParts.length - 1]++
      newRoute = routeParts.join('/')
    AlgorithmManagement.updateStatus(req.params.identifier, 'delete')
    AlgorithmManagement.updateRoute(req.params.identifier, newRoute)
    #remove /route/info.json file
    AlgorithmManagement.deleteInfoFile('/data/json' + serviceInfo.path)
    AlgorithmManagement.removeFromRootInfoFile(serviceInfo.path)
    DockerManagement.removeImage(serviceInfo.image_name, (error) ->
      if(not error?)
        schemaValidator.validate(req.body, 'createSchema', (error) ->
          if(error)
            sendError(res, error)
          else
            #docker
            identifier = AlgorithmManagement.createIdentifier()
            route = AlgorithmManagement.generateUrl(req.body)
            #check if we can find the route already
            imageName = AlgorithmManagement.generateImageName(req.body)
            createAlgorithm(req,res, route, identifier, imageName)
        )
    )
  else
    err =
      statusCode: 404
      statusText: 'No algorithm with this identifier found'
      errorType: 'No algorithm found'
    sendError(res, err)

router.post '/algorithms/:identifier/exceptions', (req, res, next) ->
  AlgorithmManagement.recordException(req.params.identifier, req.text)
  send200(res, {})

router.get '/algorithms/:identifier/exceptions', (req, res) ->
  exceptions = AlgorithmManagement.getExceptions(req.params.identifier)
  send200(res, exceptions)
  
router.delete '/algorithms/:identifier', (req, res) ->
#set algorithm status to deleted
  serviceInfo = ServicesInfoHelper.getServiceInfoByIdentifier(req.params.identifier)
  AlgorithmManagement.updateStatus(req.params.identifier, 'delete')
  #remove /route/info.json file
  AlgorithmManagement.deleteInfoFile('/data/json' + serviceInfo.path)
  AlgorithmManagement.removeFromRootInfoFile(serviceInfo.path)
  DockerManagement.removeImage(serviceInfo.image_name, (error) ->
    if(not error?)
      res.status(200).end()
      logger.log 'info', 'removing algorithm: ' + req.params.identifier
  )
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


createAlgorithm = (req,res, route, identifier, imageName) ->
  ioHelper = new IoHelper()
  ioHelper.downloadFile(req.body.method.file, '/data/executables/' + route, (err, filename) ->
    #create docker file
    DockerManagement.createDockerFile(req.body, '/data/executables/' + route)
    #create bash script
    DockerManagement.createBashScript(req.body, '/data/executables/' + route)
    #update servicesFile
    AlgorithmManagement.createInfoFile(req.body, '/data/json/' + route)
    AlgorithmManagement.updateServicesFile(req.body, identifier, route, imageName)
    AlgorithmManagement.updateRootInfoFile(req.body, route)
    AlgorithmManagement.updateStatus(identifier, 'creating', '/' + route)
    #create a tar from zip
    response =
      statusCode: 200
      identifier: identifier
      statusMessage: 'Started Algorithm Creation'
    sendResponse res, null, response

    DockerManagement.buildImage('/data/executables/' + route, imageName, (err, response) ->
      if(err?)
        AlgorithmManagement.updateStatus(identifier, 'error', null, err.statusMessage)
      else
        AlgorithmManagement.updateStatus(identifier, 'testing')
        executableHelper = new ExecutableHelper()
        tempQueue = new ProcessingQueue()
        req =
          originalUrl: '/' + route
          body:
            images: [
              {
                type: 'url'
                value: 'https://placeholdit.imgix.net/~text?txtsize=33&txt=350%C3%97150&w=350&h=150'
              }
            ]
            highlighter: {}
            inputs: {}

        executableHelper.preprocess req, tempQueue, 'test',
          (err, response) ->
            logger.log 'info', response
        ,
          () ->
            #execute the algorithm once
            executableHelper.executeDockerRequest(tempQueue.getNext())
    ))

module.exports = router