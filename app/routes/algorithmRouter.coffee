_                     = require 'lodash'
AlgorithmManagement   = require '../management/algorithmManagement'
async                 = require 'async'
DockerManagement      = require '../docker/dockerManagement'
ExecutableHelper      = require '../helper/executableHelper'
fs                    = require 'fs'
IoHelper              = require '../helper/ioHelper'
logger                = require '../logging/logger'
nconf                 = require 'nconf'
path                  = require 'path'
ResultHelper          = require '../helper/resultHelper'
router                = require('express').Router()
schemaValidator       = require '../validator/schemaValidator'
ServicesInfoHelper    = require '../helper/servicesInfoHelper'
QueueHandler          = require '../processingQueue/queueHandler'


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
  #add a new algorithm
  #get route address
  schemaValidator.validate(req.body, 'createSchema', (error) ->
    if(error)
      sendError(res, error)
    else
      #docker
      route = AlgorithmManagement.generateRoute(req.body)
      #check if we can find the route already
      status = AlgorithmManagement.getStatusByRoute('/' + route)
      imageName = AlgorithmManagement.generateImageName(req.body)
      if(status?)
        #TODO Check also against deployment statuses
        if(status.status.statusCode == 200)
          #method with this route already exists, return an error
          err =
            statusCode: 500
            statusText: 'An algorithm with the same name / type combination already exsists. Please change the name of the algorithm'
            errorType: 'MethodDuplication'
          sendError(res, err)
        else if(status.status.statusCode == 410)
          #algorithm was deleted, create a new one
          identifier = AlgorithmManagement.createIdentifier()
          createAlgorithm(req,res, route, identifier, imageName)
        else if(status.status.statusCode == 500)
          identifier = AlgorithmManagement.createIdentifier()
          AlgorithmManagement.updateIdentifier('/'+route, identifier)
          createAlgorithm(req, res, route, identifier, imageName)
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
    #remove /route/info.json file
    AlgorithmManagement.deleteInfoFile('/data/json' + serviceInfo.path)
    AlgorithmManagement.updateRoute(req.params.identifier, newRoute)
    AlgorithmManagement.removeFromRootInfoFile(serviceInfo.path)
    DockerManagement.removeImage(serviceInfo.image_name, (error) ->
      if(not error?)
        schemaValidator.validate(req.body, 'createSchema', (error) ->
          if(error)
            sendError(res, error)
          else
            #docker
            identifier = AlgorithmManagement.createIdentifier()
            #route = AlgorithmManagement.generateRoute(req.body)
            #check if we can find the route already
            imageName = AlgorithmManagement.generateImageName(req.body)
            AlgorithmManagement.generateFolders(newRoute)
            createAlgorithm(req,res, route, identifier, imageName)
        )
    )
  else
    err =
      statusCode: 404
      statusText: 'No algorithm with this identifier found'
      errorType: 'No algorithm found'
    sendError(res, err)

router.post '/algorithms/:identifier/exceptions/:jobId', (req, res, next) ->
  AlgorithmManagement.recordException(req.params.identifier, req.text)
  process = QueueHandler.getDockerJob(req.params.jobId)
  ResultHelper.removeResult(process)
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

createAlgorithm = (req,res, route, identifier, imageName) ->
  AlgorithmManagement.updateServicesFile(req.body, identifier, route, imageName)
  IoHelper.downloadFile(req.body.method.file, '/data/executables/' + route, 'application/zip', (err, filename) ->
    if(err?)
      AlgorithmManagement.updateStatus(identifier, 'error', null, 'file has wrong data format')
      response =
        statusCode: 500
        identifier: identifier
        statusMessage: 'fileUrl does not point to a correct zip file'
      sendResponse(res, null, response)
      return
    #create docker file
    DockerManagement.createDockerFile(req.body, '/data/executables/' + route)
    #create bash script
    DockerManagement.createBashScript(req.body, '/data/executables/' + route)
    #update servicesFile
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
        inputs = {}
        highlighter = {}
        for input in req.body.input
          if(not(_.keys(input)[0] in nconf.get('reservedWords')))
            switch(_.keys(input)[0])
              when 'select'
                inputs[input.select.name] = input.select.options.values[input.select.options.default]
              when 'number'
                inputs[input.number.name] = input.number.options.default
              when 'text'
                inputs[input.text.name] = input.text.options.default
              when 'highlighter'
                switch input.highlighter.type
                  when 'polygon'
                    highlighter =
                      type: 'polygon'
                      closed: true
                      segments:[[0,0],[0,150],[350,150],[350,0]]
                  when 'rectangle'
                    highlighter =
                      type: 'rectangle'
                      closed: true
                      segments:[[0,0],[0,150],[350,150],[350,0]]
        testRequest =
          originalUrl: '/' + route
          body:
            images: [
              {
                type: 'collection'
                value: 'test'
              }
            ]
            highlighter: highlighter
            inputs: inputs

        executableHelper.preprocess testRequest, QueueHandler.dockerProcessingQueue, 'test',
          (err, response) ->
            if(err?)
              logger.log 'error', err
            #logger.log 'info', response
        ,
          () ->
            job = QueueHandler.dockerProcessingQueue.getNext()
            QueueHandler.runningDockerJobs.push(job)
            #execute the algorithm once
            executableHelper.executeDockerRequest(job, (error, data) ->
              if(error)
                AlgorithmManagement.updateStatus(identifier, 'error', null, error.statusMessage)
              else
                AlgorithmManagement.updateRootInfoFile(req.body, route)
                AlgorithmManagement.createInfoFile(req.body, '/data/json/' + route)
            )
    ))

module.exports = router