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
IoHelper           = require '../helper/ioHelper'
ImageHelper        = require '../helper/imageHelper'
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
      getWithQuery(req, callback)
    #else load info file
    else
      fs.readFile nconf.get('paths:jsonPath') + req.originalUrl + '/info.json', 'utf8', (err, data) ->
        if err
          callback err
        else
          data = data.replace(new RegExp('\\$BASEURL\\$','g'),nconf.get('server:rootUrl'))
          data = JSON.parse data

          #add statistics information if available
          if(data['info']?)
            data['info']['expectedRuntime'] = Statistics.getMeanExecutionTime req.originalUrl
          callback null, data
        return
      return

  getWithQuery = (req, callback) ->
    parameterHelper = new ParameterHelper()
    ioHelper = new IoHelper()
    serviceInfo = ServicesInfoHelper.getServiceInfo(req.path)
    queryParams = req.query
    neededParameters = serviceInfo.parameters
    #perform parameter matching
    highlighter = {}
    if queryParams.highlighter?
      highlighter = JSON.parse(queryParams.highlighter)

    paramMatching = parameterHelper.matchParams(queryParams, highlighter, neededParameters, queryParams.md5,queryParams.md5, req)
    imgFolder = nconf.get('paths:imageRootPath') + path.sep + paramMatching.data['inputImage'] + '/'
    ioHelper.loadResult(imgFolder, req.path, paramMatching.params,false, (err, data) ->
      if(queryParams.requireOutputImage == 'false')
        delete data['image']
      if(!data.hasOwnProperty('status'))
        data['status'] = 'done'
      callback null, data
    )
    return

  buildResultFilePath = (paramMatching, req, callback) ->
    #replace / with _
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
