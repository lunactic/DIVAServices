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
Swagger               = require '../swagger/swagger'
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
        switch status.status.statusCode
          when 200
            #method with this route already exists, return an error
            err =
              statusCode: 500
              statusText: 'An algorithm with the same name / type combination already exsists. Please change the name of the algorithm'
              errorType: 'MethodDuplication'
            sendError(res, err)
          when 410
            #algorithm was deleted, create a new one
            identifier = AlgorithmManagement.createIdentifier()
            createAlgorithm(req,res, route, identifier, imageName)
          when 500
            DockerManagement.removeImage(status.image_name, (error) ->
              if(not error?)
                identifier = AlgorithmManagement.createIdentifier()
                AlgorithmManagement.updateIdentifier('/'+route, identifier)
                createAlgorithm(req, res, route, identifier, imageName)
            )
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
    switch serviceInfo.status.statusCode
      when 410
        #error recovery
        currentRoute = serviceInfo.path
        routeParts = currentRoute.split('/').filter((n) -> return n != '')
        lastPart = routeParts[routeParts.length - 1]
        routeParts[routeParts.length - 1]++
        newRoute = routeParts.join('/')
        AlgorithmManagement.removeFromServiceInfoFile(newRoute)
        DockerManagement.removeImage(serviceInfo.image_name, (error) ->
          if(not error?)
            schemaValidator.validate(req.body, 'createSchema', (error) ->
              if(error)
                sendError(res, error)
              else
                #docker
                identifier = AlgorithmManagement.createIdentifier()
                #check if we can find the route already
                imageName = AlgorithmManagement.generateImageName(req.body)
                AlgorithmManagement.generateFolders(newRoute)
                createAlgorithm(req,res, newRoute, identifier, imageName)
            )
        )
      else
        #build new route
        currentRoute = serviceInfo.path
        routeParts = currentRoute.split('/').filter((n) -> return n != '')
        lastPart = routeParts[routeParts.length - 1]
        routeParts[routeParts.length - 1]++
        newRoute = routeParts.join('/')
        AlgorithmManagement.updateStatus(req.params.identifier, 'delete')
        #remove /route/info.json file
        AlgorithmManagement.deleteInfoFile('/data/json' + serviceInfo.path)
        #AlgorithmManagement.updateRoute(req.params.identifier, newRoute)
        AlgorithmManagement.removeFromRootInfoFile(serviceInfo.path)
        DockerManagement.removeImage(serviceInfo.image_name, (error) ->
          if(not error?)
            schemaValidator.validate(req.body, 'createSchema', (error) ->
              if(error)
                sendError(res, error)
              else
                #docker
                identifier = AlgorithmManagement.createIdentifier()
                #check if we can find the route already
                imageName = AlgorithmManagement.generateImageName(req.body)
                AlgorithmManagement.generateFolders(newRoute)
                createAlgorithm(req,res, newRoute, identifier, imageName)
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
  if(process.type is 'test')
    AlgorithmManagement.updateStatus(process.algorithmIdentifier, 'error', process.req.originalUrl, req.text)

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
    DockerManagement.createBashScript(identifier, req.body, '/data/executables/' + route)
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
          if(not(_.keys(input)[0] in nconf.get('reservedWords')) or _.keys(input)[0] == 'highlighter')
            switch(_.keys(input)[0])
              when 'select'
                inputs[input.select.name] = input.select.options.values[input.select.options.default]
              when 'number'
                inputs[input.number.name] = input.number.options.default
              when 'text'
                inputs[input.text.name] = input.text.options.default
              when 'json'
                inputs[input.json.name] = JSON.parse(fs.readFileSync(nconf.get('paths:testPath')+'/json/array.json'))
              when 'highlighter'
                switch input.highlighter.type
                  when 'polygon'
                    highlighter =
                      type: 'polygon'
                      closed: true
                      segments:[[1,1],[1,150],[350,150],[350,1]]
                  when 'rectangle'
                    highlighter =
                      type: 'rectangle'
                      closed: true
                      segments:[[1,1],[1,150],[350,150],[350,1]]

        inputs['highlighter'] = highlighter
        testRequest =
          originalUrl: '/' + route
          body:
            images: [
              {
                type: 'collection'
                value: 'test'
              }
            ]
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
              if(!error?)
                AlgorithmManagement.updateRootInfoFile(req.body, route)
                AlgorithmManagement.createInfoFile(req.body, '/data/json/' + route)
                #add too swagger
                info = IoHelper.loadFile('/data/json/' + route + '/info.json')
                Swagger.createEntry(info, route)
                #1 read algorithm info.json
                #2 call Swagger.createEntry
            )
    ))

module.exports = router