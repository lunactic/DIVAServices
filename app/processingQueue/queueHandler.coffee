ProcessingQueue = require './processingQueue'

queueHandler = exports = module.exports = class QueueHandler
  @processingQueue = null
  constructor: ->
    @processingQueue = new ProcessingQueue()

  addRequestToQueue: (req) ->
    @processingQueue.addElement(req)

  getNextRequest: () ->
    return @processingQueue.getNext()
