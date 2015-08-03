# GetHandler
# =======
#
# **GetHandler** is responsible for handling all incoming GET requests.
# It responds with the JSON informatio as defined in
# ```server.XXX.json['paths']['jsonPath']/req.originalUrl/info.json``` file
# This means a GET request to /segmentation/textline/hist will return the JSON information in the file
# /data/json/segmentation/textline/hist/info.json.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.
fs                 = require 'fs'
nconf              = require 'nconf'
path               = require 'path'
Statistics         = require '../statistics/statistics'
ParameterHelper    = require '../helper/parameterHelper'
ServicesInfoHelper = require '../helper/servicesInfoHelper'

#Expose getHandler
getHandler = exports = module.exports = class GetHandler

  # ---
  # **handleRequest**</br>
  # Handle incoming GET requests</br>
  # `params`
  #   *req* the incoming request
  handleRequest: (req, callback) ->
    #check if incoming get request has a query param
    if(Object.keys(req.query).length != 0)
      parameterHelper = new ParameterHelper()
      serviceInfo = ServicesInfoHelper.getServiceInfo(req.path)
      queryParams = req.query
      neededParameters = serviceInfo.parameters
      #perform parameter matching
      paramMatching = parameterHelper.matchParams(queryParams, JSON.parse(queryParams.highlighter), neededParameters, queryParams.md5, req)
      buildResultFilePath(paramMatching, req, callback)
      return
    #else load info file
    else
      fs.readFile nconf.get('paths:jsonPath') + req.originalUrl + '/info.json', 'utf8', (err, data) ->
        if err
          callback err
        else
          data = JSON.parse data
          if(data['info']?)
            data['info']['expectedRuntime'] = Statistics.getMeanExecutionTime req.originalUrl
          callback null, data
        return
      return

  buildResultFilePath = (paramMatching, req, callback) ->
    #replace / with _
    console.log 'paramMatching: ' + JSON.stringify paramMatching
    algorithm = req.path.replace(/\//g, '_')
    params = paramMatching.params.join('_').replace RegExp(' ', 'g'), '_'
    filename = algorithm + '_' + params + '.json'
    folder = nconf.get('paths:imageRootPath') + path.sep + paramMatching.data[0]
    fs.stat folder + path.sep + filename, (err, stat) ->
      #check if file exists
      #console.log err
      if !err?
        fs.readFile folder + path.sep + filename, 'utf8', (err, data) ->
          if err?
            callback err, null
          else
            callback null, JSON.parse(data)
      else
        error =
          status: 404
          statusText: 'Result not found'
        callback error, null
