Statistics          = require '../statistics/statistics'
ProcessingQueue     = require './processingQueue'
ExecutableHelper    = require '../helper/executableHelper'

queueHandler = exports = module.exports = class QueueHandler

  instance = null
  @processingQueue = null

  constructor: () ->
    @processingQueue = new ProcessingQueue()
    @executableHelper = new ExecutableHelper()
    self = @
    @executableHelper.on 'processingFinished', () ->
      self.executeRequest()

  addRequestToQueue: (req,requestCallback) ->
    self = @
    @executableHelper.preprocessing req,@processingQueue,requestCallback, () ->
      self.executeRequest()

  requestAvailable: () ->
    return @processingQueue.getSize() > 0

  getNextRequest: () ->
    return @processingQueue.getNext()

  getQueueSize:() ->
    return @processingQueue.getSize

  executeRequest: () ->
    if(Statistics.getNumberOfCurrentExecutions() < 5 && @requestAvailable())
      @executableHelper.executeRequest(@getNextRequest())
    
