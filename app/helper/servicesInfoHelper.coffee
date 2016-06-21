# ServicesInfoHelper
# =======
#
# **ServicesInfoHelper** provides access to information stored in the services.json configuration file

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
