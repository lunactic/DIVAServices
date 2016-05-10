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
  if(status.statusCode? and status.statusCode == 404)
    sendResponse(res, null, status)
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
      #TODO Generate image name
      #check if we can find the route already
      status = AlgorithmManagement.getStatusByRoute('/' + route)
      imageName = AlgorithmManagement.generateImageName(req.body)
      if(status?)
        if(status.status.statusCode == 410)
          ioHelper.downloadFile(req.body.method.file, '/data/executables/' + route, (err, filename) ->
            #create docker file
            DockerManagement.createDockerFile(req.body, '/data/executables/' + route)
            #create bash script
            DockerManagement.createBashScript(req.body, '/data/executables/' + route)
            #update servicesFile
            AlgorithmManagement.createInfoFile(req.body, '/data/json/' + route)
            AlgorithmManagement.updateRootInfoFile(req.body, route)
            AlgorithmManagement.updateStatus(status.identifier, 'creating', '/' + route)
            #create a tar from zip
            response =
              statusCode: 200
              identifier: status.identifier
              statusMessage: 'Started Algorithm Creation'
            sendResponse res, null, response

            DockerManagement.buildImage('/data/executables/' + route, imageName, (err, response) ->
              if(err?)
                AlgorithmManagement.updateStatus(status.identifier, 'error', null, err.statusMessage)
              else
                AlgorithmManagement.updateStatus(status.identifier, 'testing')
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
        else
          response =
            statusCode: status.status.statusCode
            identifier: status.identifier
            statusMessage: status.status.statusMessage
          sendResponse res, null, response
      else
        identifier = AlgorithmManagement.createIdentifier()
        AlgorithmManagement.generateFolders(route)
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
            message: 'Started Algorithm Creation'
          sendResponse(res, null, response)
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
  )

router.put '/algorithms/:identifier', (req, res) ->
  ioHelper = new IoHelper()
  route = AlgorithmManagement.generateUrl(req.body)
  status = AlgorithmManagement.getStatusByRoute('/' + route)
  #perform a deletion and an addition of the new algorithm
  serviceInfo = ServicesInfoHelper.getServiceInfoByIdentifier(req.params.identifier)
  if(serviceInfo?)
    AlgorithmManagement.updateStatus(req.params.identifier, 'delete')
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
            route = AlgorithmManagement.generateUrl(req.body)
            #TODO Generate image name
            #check if we can find the route already
            imageName = AlgorithmManagement.generateImageName(req.body)
            ioHelper.downloadFile(req.body.method.file, '/data/executables/' + route, (err, filename) ->
              #create docker file
              DockerManagement.createDockerFile(req.body, '/data/executables/' + route)
              #create bash script
              DockerManagement.createBashScript(req.body, '/data/executables/' + route)
              #update servicesFile
              AlgorithmManagement.createInfoFile(req.body, '/data/json/' + route)
              AlgorithmManagement.updateRootInfoFile(req.body, route)
              AlgorithmManagement.updateStatus(status.identifier, 'creating', '/' + route)
              #create a tar from zip
              response =
                statusCode: 200
                identifier: status.identifier
                statusMessage: 'Started Algorithm Creation'
              sendResponse res, null, response

              DockerManagement.buildImage('/data/executables/' + route, imageName, (err, response) ->
                if(err?)
                  AlgorithmManagement.updateStatus(status.identifier, 'error', null, err.statusMessage)
                else
                  AlgorithmManagement.updateStatus(status.identifier, 'testing')
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
        )
    )
  else
    err =
      statusCode: 404
      statusText: 'No algorithm with this identifier found'
      errorType: 'No algorithm found'
    sendError(res, err)

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

module.exports = router