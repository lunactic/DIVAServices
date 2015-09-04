events          = require 'events'
util            = require 'util'
Statistics          = require '../statistics/statistics'
ProcessingQueue = require './processingQueue'
ExecutableHelper  = require '../helper/executableHelper'

queueHandler = exports = module.exports = class QueueHandler
  util.inherits QueueHandler, events.EventEmitter

  instance = null
  @processingQueue = null

  constructor: () ->
    @processingQueue = new ProcessingQueue()
    @executableHelper = new ExecutableHelper()

  addRequestToQueue: (req,requestCallback) ->
    self = @
    @executableHelper.preprocessing req,@processingQueue,requestCallback, () ->
      self.executeRequest()


  getNextRequest: () ->
    return @processingQueue.getNext()

  getQueueSize:() ->
    return @processingQueue.getSize

  executeRequest: (req, cb) ->
    console.log 'EXECUTE REQUEST'
    if(Statistics.getNumberOfCurrentExecutions() < 5)
      @executableHelper.executeRequest(@getNextRequest())
