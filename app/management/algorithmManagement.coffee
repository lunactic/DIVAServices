logger = require '../logging/logger'
mkdirp = require 'mkdirp'
algorithmManagement = exports = module.exports = class AlgorithmManagement

  @generateUrl: (newAlgorithm) ->
    newAlgorithm.name.trim()
    return newAlgorithm.namespace + '/' + newAlgorithm.name.replace(/\s/g,'').toLowerCase()

  @generateFolders: (route) ->
    mkdirp('/data/executables/' + route, (err) ->
      if(err)
        logger.log 'error', err
      else
        return
    )