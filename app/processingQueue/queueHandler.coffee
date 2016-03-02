
logger              = require '../logging/logger'
Statistics          = require '../statistics/statistics'
ProcessingQueue     = require './processingQueue'
ExecutableHelper    = require '../helper/executableHelper'

queueHandler = exports = module.exports = class QueueHandler

  @localProcessingQueue = null
  @remoteProcessingQueue = null

  constructor: () ->
    if(not @localProcessingQueue?)
      @localProcessingQueue = new ProcessingQueue()
    if(not @remoteProcessingQueue?)
      @remoteProcessingQueue = new ProcessingQueue()

    @executableHelper = new ExecutableHelper()
    self = @
    @executableHelper.on 'processingFinished', () ->
      self.executeLocalRequest()

  addLocalRequestToQueue: (req, cb) ->
    self = @
    @executableHelper.preprocess req, @localProcessingQueue, cb, () ->
      self.executeLocalRequest()

  addRemoteRequestToQueue: (req, cb) ->
    self = @
    @executableHelper.preprocess req, @remoteProcessingQueue, cb, () ->
      #TODO: ADD SPECIAL REMOTE PREPROCESSING HERE
      self.executeRemoteRequest()

  localRequestAvailable: () ->
    return @localProcessingQueue.getSize() > 0

  remoteRequestAvailable: () ->
    return @remoteProcessingQueue.getSize() > 0

  getNextLocalRequest: () ->
    return @localProcessingQueue.getNext()

  getNextRemoteRequest: () ->
    return @remoteProcessingQueue.getNext()

  getLocalQueueSize:() ->
    return @localProcessingQueue.getSize()

  getRemoteQueueSize: () ->
    return @remoteProcessingQueue.getSize()

  executeLocalRequest: () ->
    #TODO: Replace getNumberOfCurrentExecutions() with some form of available computing time
    if(Statistics.getNumberOfCurrentExecutions() < 2 && @localRequestAvailable())
      @executableHelper.executeLocalRequest(@getNextLocalRequest())

  executeRemoteRequest: () ->
    logger.log 'info', 'execute remote request'
    if(@remoteRequestAvailable())
      @executableHelper.executeRemoteRequest(@getNextRemoteRequest())
