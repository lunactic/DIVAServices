fs      = require 'fs'
logger  = require '../logging/logger'
class IoHelper
  constructor: () ->

  loadResult: (path, algorithm, params, callback) ->
    algorithm = algorithm.replace(/\//g, '_')
    #join params with _
    params = params.join('_').replace RegExp(' ', 'g'), '_'
    filename = algorithm + '_' + params + '.json'

    fs.stat path + filename, (err, stat) ->
      #check if file exists
      #console.log err
      if !err?
        fs.readFile path + filename, 'utf8', (err, data) ->
          if err?
            callback err
          else
            callback null, data
      else
        console.log 'result not found'
        callback null, null



  saveResult: (path, algorithm, params, result, callback) ->
    #replace / with _
    algorithm = algorithm.replace(/\//g, '_')
    #join params with _
    params = params.join('_').replace RegExp(' ', 'g'), '_'
    filename = algorithm + '_' + params + '.json'

    fs.stat path + filename, (err, stat) ->
      #check if file exists
      if !err?
        return
      else if err.code == 'ENOENT'
        fs.writeFile path + filename, result,  (err) ->
          if err?
            error = []
            error.status = 500
            error.statusText = 'Could not save result file'
            callback error
          return
    return

module.exports = IoHelper
