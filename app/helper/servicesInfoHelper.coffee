# ServicesInfoHelper
# =======
#
# **ServicesInfoHelper** provides access to information stored in the services.json configuration file

_     = require 'lodash'
nconf = require 'nconf'
fs    = require 'fs'
IoHelper = require './ioHelper'


servicesInfoHelper = exports = module.exports = class ServicesInfoHelper

  @fileContent ?= JSON.parse(fs.readFileSync(nconf.get('paths:servicesInfoFile'), 'utf8'))

  @getServiceInfoByPath: (servicePath) ->
    @reload()
    serviceInfo = @fileContent.services.filter((item) ->
      item.path == servicePath
    )
    return serviceInfo[0]
  
  @getServiceInfoByName: (serviceName) ->
    @reload()
    serviceInfo = @fileContent.services.filter((item) ->
      item.service == serviceName
    )
    return serviceInfo[0]

  @getServiceInfoByIdentifier: (identifier) ->
    @reload()
    serviceInfo = @fileContent.services.filter((item) ->
      item.identifier == identifier
    )
    return serviceInfo[0]


  @update: (newData) ->
    IoHelper.saveFile(nconf.get('paths:servicesInfoFile'), newData, (err) ->
      return
    )
  
  @reload: () ->
    @fileContent = JSON.parse(fs.readFileSync(nconf.get('paths:servicesInfoFile'), 'utf8'))

  @methodRequireFiles: (serviceInfo) ->
    fileParameters = _.filter(serviceInfo.parameters, (parameter)->
      return _.keys(parameter)[0] in ['inputImage', 'inputFile']
    )
    return fileParameters.length > 0

  @methodRequireSaveData: (serviceInfo) ->
    saveDataParameters = _.filter(serviceInfo.parameters, (parameter)->
      return parameter[_.keys(parameter)[0]] in ['json']
    )
