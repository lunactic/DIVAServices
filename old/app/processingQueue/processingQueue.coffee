class ProcessingQueue

  constructor: () ->
    @queue = []

  addElement: (element) ->
    @queue.push(element)
  getNext: ->
    return @queue.shift()
  getSize: ->
    return @queue.length

module.exports = ProcessingQueue