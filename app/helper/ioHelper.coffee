# IoHelper
# =======
#
# **IoHelper** provides helper methods for handling with files
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.

# Module dependecies
fs      = require 'fs'
_       = require 'lodash'
logger  = require '../logging/logger'


# expose IoHelper
ioHelper = exports = module.exports = class IoHelper

  buildFilePath: (path,algorithm,params) ->
    algorithm = algorithm.replace(/\//g, '_')
    #join params with _
    tmpParams = JSON.parse(JSON.stringify(params))
    values = _.valuesIn(tmpParams).join(' ').replace(RegExp(' ', 'g'), '_')
    filename = algorithm + '_' + values + '.json'
    return path + filename

  buildTempFilePath: (path,algorithm,params) ->
    algorithm = algorithm.replace(/\//g, '_')
    #join params with _
    tmpParams = JSON.parse(JSON.stringify(params))
    values = _.valuesIn(tmpParams).join(' ').replace(RegExp(' ', 'g'), '_')
    filename = algorithm + '_' + values + '_temp.json'
    return path + filename

  # ---
  # **loadResult**</br>
  # Loads existing results from the disk</br>
  # `params`
  #   *path* path to the image folder, where results are stored
  #   *algorithm* the executed algorithm
  #   *params* the used parameter values
  loadResult: (path, algorithm, params, post, callback) ->
    filePath = @buildFilePath(path,algorithm,params)
    logger.log "info",'load from file  ' + filePath

    fs.stat filePath, (err, stat) ->
      #check if file exists
      if !err?
        fs.readFile filePath, 'utf8', (err, data) ->
          if err?
            callback err, null
          else
            data = JSON.parse(data)
            callback null, data
      else
        if(post)
          callback null, null
        else
          logger.log 'error', err
          callback err,null
  # ---
  # **/br>
  # Saves the results of a method execution to the disk</br>
  # `params`
  #   *path*  path to the image folder, where results are stored
  #   *algorithm* the executed algorithm
  #   *params*  the used parameter values
  #   *result*  the execution result
  saveResult: (filePath, result, callback) ->
    fs.stat filePath, (err, stat) ->
      #check if file exists
      #console.log 'saving file to: ' + filePath
      fs.writeFile filePath, result,  (err) ->
        if err?
          error =
            status: 500
            statusText: 'Could not save result file'
          callback error, null
        else
          callback null, result
        return
    return


  writeTempFile: (filePath, callback) ->
    fs.stat filePath, (err, stat) ->
      #check if file exists
      #console.log 'saving file to: ' + filePath
      fs.writeFile filePath, JSON.stringify({status :'planned'}),  (err) ->
        if err?
          error =
            status: 500
            statusText: 'Could not save result file'
          callback error, null
        else
          callback null, null
        return
    return
