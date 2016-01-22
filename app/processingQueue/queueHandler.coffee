Statistics          = require '../statistics/statistics'
ProcessingQueue     = require './processingQueue'
ExecutableHelper    = require '../helper/executableHelper'

queueHandler = exports = module.exports = class QueueHandler

  @processingQueue = null

  constructor: () ->
    @processingQueue = new ProcessingQueue()
    @executableHelper = new ExecutableHelper()
    self = @
    @executableHelper.on 'processingFinished', () ->
      self.executeRequest()

  executeRequestImmediately: (req, cb) ->
    self = @
    tempProcessingQueue = new ProcessingQueue()
    @executableHelper.preprocess req, tempProcessingQueue, true,cb, () ->
      self.executableHelper.executeRequest tempProcessingQueue.getNext()

  addRequestToQueue: (req) ->
    self = @
    @executableHelper.preprocess req,@processingQueue,false, () ->
      self.executeRequest()

  requestAvailable: () ->
    return @processingQueue.getSize() > 0

  getNextRequest: () ->
    return @processingQueue.getNext()

  getQueueSize:() ->
    return @processingQueue.getSize

  executeRequest: () ->
    #TODO: Replace getNumberOfCurrentExecutions() with some form of available computing time
    if(Statistics.getNumberOfCurrentExecutions() < 5 && @requestAvailable())
      @executableHelper.executeRequest(@getNextRequest())
