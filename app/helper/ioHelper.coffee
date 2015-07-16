fs = require 'fs'

class IoHelper
  constructor: () ->

  saveResult: (path, algorithm, params, result) ->
    console.log 'path: ' + path
    console.log 'algorithm: ' + algorithm
    console.log 'params: ' + params
    console.log 'filename: ' + filename

    #replace / with _
    algorithm = algorithm.replace(/\//g, '_')
    #join params with _
    params = params.join('_')
    filename = algorithm + '_' + params + '.json'

    fs.stat path + filename, (err, stat) ->
      #check if file exists
      if !err?
        return
      else if err.code == 'ENOENT'
        fs.writeFile path + filename, result, 'utf8', (err) ->
          console.log err
          return
    return

module.exports = IoHelper
