# ServicesInfoHelper
# =======
#
# **ServicesInfoHelper** provides access to information stored in the services.json configuration file

nconf = require 'nconf'
fs    = require 'fs'

servicesInfoHelper = exports = module.exports = class ServicesInfoHelper

  @fileContent ?= JSON.parse(fs.readFileSync(nconf.get('paths:servicesInfoFile'), 'utf8'))

  @getServiceInfoByPath: (servicePath) ->
    serviceInfo = @fileContent.services.filter((item) ->
      item.path == servicePath
    )
    return serviceInfo[0]

  @getServiceInfoByName: (serviceName) ->
    serviceInfo = @fileContent.services.filter((item) ->
      item.service = serviceName
    )
    return serviceInfo[0]
  