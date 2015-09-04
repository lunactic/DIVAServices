# IoHelper
# =======
#
# **IoHelper** provides helper methods for handling with files
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependecies
fs      = require 'fs'
logger  = require '../logging/logger'

# expose IoHelper
ioHelper = exports = module.exports = class IoHelper

  # ---
  # **loadResult**</br>
  # Loads existing results from the disk</br>
  # `params`
  #   *path* path to the image folder, where results are stored
  #   *algorithm* the executed algorithm
  #   *params* the used parameter values
  loadResult: (path, algorithm, params, post, callback) ->
    algorithm = algorithm.replace(/\//g, '_')
    #join params with _
    params = params.join('_').replace RegExp(' ', 'g'), '_'
    filename = algorithm + '_' + params + '.json'
    fs.stat path + filename, (err, stat) ->
      #check if file exists
      if !err?
        fs.readFile path + filename, 'utf8', (err, data) ->
          if err?
            callback err, null
          else
            callback null, data
      else
        if(post)
          callback null, null
        else
          callback err,null
  # ---
  # **/br>
  # Saves the results of a method execution to the disk</br>
  # `params`
  #   *path*  path to the image folder, where results are stored
  #   *algorithm* the executed algorithm
  #   *params*  the used parameter values
  #   *result*  the execution result
  saveResult: (path, algorithm, params, result, callback) ->
    #replace / with _
    algorithm = algorithm.replace(/\//g, '_')
    #join params with _
    params = params.join('_').replace RegExp(' ', 'g'), '_'
    filename = algorithm + '_' + params + '.json'

    fs.stat path + filename, (err, stat) ->
      #check if file exists
      console.log 'saving file to: ' + path + filename
      fs.writeFile path + filename, result,  (err) ->
        if err?
          error =
            status: 500
            statusText: 'Could not save result file'
          callback error, null
        else
          console.log 'file saved'
          callback null, result
        return
    return


  writeTempFile: (path, algorithm, params, callback) ->
    algorithm = algorithm.replace(/\//g, '_')
    #join params with _
    params = params.join('_').replace RegExp(' ', 'g'), '_'
    filename = algorithm + '_' + params + '.json'
    fs.stat path + filename, (err, stat) ->
      #check if file exists
      if !err?
        callback null, result
      else if err.code == 'ENOENT'
        fs.writeFile path + filename, JSON.stringify({status: 'planned'}),  (err) ->
          if err?
            logger.log 'error', err
            error =
              status: 500
              statusText: 'Could not save result file'
            callback error, null
          else
            callback null, null
          return
    return
