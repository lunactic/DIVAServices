_       = require 'lodash'
logger = require '../logging/logger'
Statistics = require '../statistics/statistics'
ProcessingQueue = require './processingQueue'
ExecutableHelper = require '../helper/executableHelper'

class QueueHandler

  @localProcessingQueue = null
  @remoteProcessingQueue = null
  @dockerProcessingQueue = null
  @runningDockerJobs = null
  @initialize: () ->
    if(not @localProcessingQueue?)
      @localProcessingQueue = new ProcessingQueue()
    if(not @remoteProcessingQueue?)
      @remoteProcessingQueue = new ProcessingQueue()
    if(not @dockerProcessingQueue?)
      @dockerProcessingQueue = new ProcessingQueue()
      @runningDockerJobs = []

    @executableHelper = new ExecutableHelper()
    self = @
    @executableHelper.on 'processingFinished', () ->
      self.executeLocalRequest()

  @addLocalRequestToQueue: (req, cb) ->
    self = @
    @executableHelper.preprocess req, @localProcessingQueue, 'regular', cb, () ->
      self.executeLocalRequest()

  @addRemoteRequestToQueue: (req, cb) ->
    self = @
    @executableHelper.preprocess req, @remoteProcessingQueue, 'regular', cb, () ->
      self.executeRemoteRequest()

  #TODO use the callback in executeDockerRequest
  @addDockerRequestToQueue: (req, cb) ->
    @executableHelper.preprocess req, @dockerProcessingQueue, 'regular', cb, () ->
      executeDockerRequest()

  @getDockerJob: (jobId) ->
    job = _.find(@runningDockerJobs, {'id':jobId})
    _.remove(@runningDockerJobs, {'id':jobId})
    return job

  dockerRequestAvailable = () ->
    return QueueHandler.dockerProcessingQueue.getSize() > 0

  localRequestAvailable = () ->
    return QueueHandler.localProcessingQueue.getSize() > 0

  remoteRequestAvailable = () ->
    return QueueHandler.remoteProcessingQueue.getSize() > 0

  getNextLocalRequest = () ->
    return QueueHandler.localProcessingQueue.getNext()

  getNextDockerRequest = () ->
    return QueueHandler.dockerProcessingQueue.getNext()

  getNextRemoteRequest = () ->
    return QueueHandler.remoteProcessingQueue.getNext()

  #TODO use the callback in executeDockerRequest
  executeDockerRequest =  () ->
    logger.log 'info', 'execute docker request'
    if(dockerRequestAvailable())
      job = getNextDockerRequest()
      QueueHandler.runningDockerJobs.push(job)
      QueueHandler.executableHelper.executeDockerRequest(job)

  executeLocalRequest = () ->
    #TODO: Replace getNumberOfCurrentExecutions() with some form of available computing time
    if(Statistics.getNumberOfCurrentExecutions() < 2 && localRequestAvailable())
      QueueHandler.executableHelper.executeLocalRequest(getNextLocalRequest())

  executeRemoteRequest = () ->
    logger.log 'info', 'execute remote request'
    if(remoteRequestAvailable())
      QueueHandler.executableHelper.executeRemoteRequest(getNextRemoteRequest())

module.exports = QueueHandler