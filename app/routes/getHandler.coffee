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
_                   = require 'lodash'
AlgorithmManagement = require '../management/algorithmManagement'
fs                  = require 'fs'
nconf               = require 'nconf'
path                = require 'path'
Collection          = require '../processingQueue/collection'
Statistics          = require '../statistics/statistics'
ParameterHelper     = require '../helper/parameterHelper'
Process             = require '../processingQueue/process'
ResultHelper        = require '../helper/resultHelper'
ImageHelper         = require '../helper/imageHelper'
ServicesInfoHelper  = require '../helper/servicesInfoHelper'

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
        if err?
          algo = AlgorithmManagement.getStatusByRoute(req.originalUrl)
          if(algo?)
            error = createError(algot.status.statusCode, algo.status.statusMessage)
          else
            error = createError(404,'This algorithm is not available')
          callback error
        else
          data = data.replace(new RegExp('\\$BASEURL\\$','g'),nconf.get('server:rootUrl'))
          data = JSON.parse data

          #add statistics information if available
          if(data.general? and not data.general.expectedRuntime?)
            data.general.expectedRuntime = Statistics.getMeanExecutionTime req.originalUrl
          if(data.general? and not data.general.executions?)
            data.general.executions = Statistics.getNumberOfExecutions req.originalUrl
          callback null, data
        return
      return

  getWithQuery = (req, callback) ->
    parameterHelper = new ParameterHelper()
    serviceInfo = ServicesInfoHelper.getServiceInfoByPath(req.path)
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
      prepareQueryParams(collection, queryParams)
      folder = nconf.get('paths:imageRootPath') + path.sep + collection.name
      collection.neededParameters = neededParameters
      collection.inputParameters = queryParams
      collection.image =
        path: folder
        md5:  ""
      collection.outputFolder = folder
      collection.parameters = parameterHelper.matchParams(collection,req)
      if(ResultHelper.checkCollectionResultAvailable(collection))
        data = ResultHelper.loadResult collection
        callback null,data
        return
      else
        err = createError(404,'This result is not available')
        callback err, null

    else if queryParams['md5']?
      #locate the image folder
      ImageHelper.imageExists(queryParams.md5, (err, data) ->
        if(err?)
          error = createError(404,'Image no available')
          callback error, null
          return
        if(data.imageAvailable)
          images = ImageHelper.loadImagesMd5(queryParams.md5)
          #search in the folder of each image
          for image in images
            process = new Process()
            process.image = image
            prepareQueryParams(process,queryParams)
            process.parameters = parameterHelper.matchParams(process, req)
            process.method = serviceInfo.service
            process.rootFolder = image.folder.split(path.sep)[image.folder.split(path.sep).length-2]
            #TODO Is this needed in the future, when everything is starting from the point of a collection?
            if(ResultHelper.checkProcessResultAvailable(process))
              process.result = ResultHelper.loadResult process
              if(queryParams.requireOutputImage is 'false' && process.result['image']?)
                delete process.result['image']
              if(!process.result?)
                process.result = {status: 'planned'}
              if(!process.result.hasOwnProperty('status'))
                process.result['status'] = 'done'
              callback null, process.result
              return
          #if the callback was not called yet, we can assume that the result is not available
          err = createError(404,'This result is not available')
          callback err, null
          return
      )
    else if queryParams['rootFolder']
      #try to load results
      process = new Process()
      prepareQueryParams(process,queryParams)
      process.neededParameters = serviceInfo.parameters
      prepareNeededParameters(process)
      process.parameters = parameterHelper.matchParams(process, req)
      process.method = serviceInfo.service
      process.rootFolder = queryParams['rootFolder']
      if(ResultHelper.checkProcessResultAvailable(process))
        process.result = ResultHelper.loadResult process
        if(queryParams.requireOutputImage is 'false' && process.result['image']?)
          delete process.result['image']
        if(!process.result.hasOwnProperty('status'))
          process.result['status'] = 'done'
        callback null, process.result
        return
      err = createError(400, 'Malformed request. Parsing of the provided information was not possible')
      callback err, null
    else
      erro = createError(500, 'Could not parse this request')

  prepareQueryParams = (proc, queryParams) ->
    proc.inputParameters = _.clone(queryParams)
    _.unset(proc.inputParameters,'md5')
    _.unset(proc.inputParameters,'highlighter')
    _.unset(proc.inputParameters,'highlighterType')
    _.unset(proc.inputParameters,'collection')
    _.unset(proc.inputParameters, 'rootFolder')
    params = {}
    if(queryParams.highlighter?)
      params = JSON.parse(queryParams.highlighter)

    if(queryParams.highlighter?)
      proc.inputHighlighters =
        type: queryParams.highlighterType
        segments: String(params)
        closed: 'true'
    else
      proc.inputHighlighters = {}

    return
  prepareNeededParameters = (process) ->
    for reservedWord in nconf.get('reservedWords')
      _.unset(process.neededParameters, reservedWord)
    return


  createError = (status, message) ->
    err =
      statusCode: status
      statusText: message
    return err