processingQueue = exports = module.exports = class processingQueue

  @queue = []

  constructor: () ->
    @queue = []

  addElement: (element) ->
     @queue.push(element)
     console.log "queue: " + @queue.length
  getNext: ->
     return @queue.shift()
  getSize: ->
    return @queue.length
