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

  exeucteRequestImmediately: (req, requestCallback) ->
    self = @
    tempProcessingQueue = new ProcessingQueue()
    @executableHelper.preprocessing req, tempProcessingQueue, true, requestCallback, () ->
      self.executableHelper.executeRequest(tempProcessingQueue.getNext(), requestCallback)

  addRequestToQueue: (req,requestCallback) ->
    self = @
    @executableHelper.preprocessing req,@processingQueue,false, requestCallback, () ->
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
