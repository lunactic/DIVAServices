events          = require 'events'
util            = require 'util'
ProcessingQueue = require './processingQueue'
ExecutableHelper  = require '../helper/executableHelper'

queueHandler = exports = module.exports = class QueueHandler
  util.inherits QueueHandler, events.EventEmitter

  instance = null
  @processingQueue = null

  constructor: () ->
    @processingQueue = new ProcessingQueue()
    @executableHelper = new ExecutableHelper()
  addRequestToQueue: (req,cb) ->
    @processingQueue.addElement(req)
    @executableHelper.preprocessing(req,cb)
  getNextRequest: () ->
    return @processingQueue.getNext()
