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
Collection         = require '../processingQueue/collection'
Statistics         = require '../statistics/statistics'
ParameterHelper    = require '../helper/parameterHelper'
Process            = require '../processingQueue/process'
ResultHelper       = require '../helper/resultHelper'
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
    highlighter = {}
    if queryParams.highlighter?
      highlighter = JSON.parse(queryParams.highlighter)

    #distinguish between loading of the result of a single image or a collection
    if queryParams['collection']?
      collection = new Collection()
      collection.name = queryParams['collection']
      collection.method = parameterHelper.getMethodName(req.path)
      folder = nconf.get('paths:imageRootPath') + path.sep + collection
      collection.parameters = parameterHelper.matchParams(queryParams,highlighter, neededParameters,folder,folder,"",req)
      parameterHelper.loadParamInfo collection,collection.name, collection.method
      if(collection.outputFolder.length != 0)
        data = ResultHelper.loadResult collection
        callback null,data
        return
      else
        err =
          status: 404
          statusText: 'This result is not available'
        callback err, null

    else if queryParams['md5']?
      #locate the image folder
      ImageHelper.imageExists(queryParams.md5, (err, data) ->
        if(err?)
          error =
            status: 404
            statusText: 'Error loading the image'
          return
        if(data.imageAvailable)
          images = ImageHelper.loadImagesMd5(queryParams.md5)
          #search in the folder of each image
          for image in images
            process = new Process()
            process.image = image
            process.parameters = parameterHelper.matchParams(queryParams,highlighter,neededParameters,image.path,process.image.path, process.image.md5, req)
            process.method = parameterHelper.getMethodName(req.path)
            process.rootFolder = image.folder.split(path.sep)[image.folder.split(path.sep).length-2]
            #use loadParamInfo to get all necessary parameters
            if(ResultHelper.checkProcessResultAvailable(process))
              process.result = ResultHelper.loadResult process
              if(queryParams.requireOutputImage is 'false' && process.result['image']?)
                delete process.result['image']
              if(!process.result.hasOwnProperty('status'))
                process.result['status'] = 'done'
              callback null, process.result
              return

          #if the callback was not called yet, we can assume that the result
          err =
            status: 404
            statusText: 'This result is not available'
          callback err, null
          #return error message that image is not available
      )
    else
      err =
        status: 400
        statusText: 'Malformed request. Parsing of the provided information was not possible'
      callback err, null



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
