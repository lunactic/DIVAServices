processingQueue = exports = module.exports = class localProcessingQueue

  constructor: () ->
    @queue = []

  addElement: (element) ->
    @queue.push(element)
  getNext: ->
    return @queue.shift()
  getSize: ->
    return @queue.length
