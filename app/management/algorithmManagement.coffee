_                   = require 'lodash'
crypto              = require 'crypto'
IoHelper            = require '../helper/ioHelper'
logger              = require '../logging/logger'
mkdirp              = require 'mkdirp'
nconf               = require 'nconf'
path                = require 'path'
ServicesInfoHelper  = require '../helper/servicesInfoHelper'

class AlgorithmManagement

  @ioHelper = new IoHelper()

  @getStatusByIdentifier: (identifier) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    info = _.find(content.services, {'identifier':identifier})
    if(info?)
      message =
        status: info.status
        statistics: info.statistics
      return message
    else
      return null

  @getStatusByRoute: (route) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    status = _.find(content.services, ('path':route))
    if(status?)
      return status
    else
      return null

  @createIdentifier: () ->
    current_date = (new Date).valueOf().toString()
    random = Math.random().toString()
    return crypto.createHash('sha1').update(current_date + random).digest 'hex'

  @generateRoute: (newAlgorithm) ->
    return newAlgorithm.general.type.toLowerCase() + '/' + newAlgorithm.general.name.replace(/\s/g, '').toLowerCase() + '/1'

  @generateFolders: (route) ->
    mkdirp.sync('/data/executables/' + route)
    mkdirp.sync('/data/json/' + route)
    return

  @generateImageName: (newAlgorithm) ->
    return newAlgorithm.general.type.toLowerCase() + newAlgorithm.general.name.toLowerCase().replace(/\s/g, '_')

  @createInfoFile: (newAlgorithm, folder) ->
    data = _.cloneDeep(newAlgorithm)
    reservedWords = _.clone(nconf.get('reservedWords'))
    _.remove(reservedWords, (word) ->
      return (word is 'highlighter')
    )
    _.unset(data, 'output')
    _.unset(data, 'method')
    _.forEach(data.input, (input) ->
      if(_.includes(reservedWords, _.keys(input)[0]))
        input[_.keys(input)[0]]['userdefined'] = false
        return
      else
        input[_.keys(input)[0]]['userdefined'] = true
    )

    IoHelper.saveFile(folder + path.sep + 'info.json', data, (err) ->
      if(err)
        logger.log 'error', err
      else
        logger.log 'info', 'saved file'
        return
    )
  @deleteInfoFile: (folder) ->
    IoHelper.deleteFile(folder + path.sep + 'info.json')

  @updateRootInfoFile: (newAlgorithm, route) ->
    fileContent = IoHelper.loadFile(nconf.get('paths:rootInfoFile'))
    newEntry =
      name: newAlgorithm.general.name
      description: newAlgorithm.general.description
      type: newAlgorithm.general.type
      url: 'http://$BASEURL$/' + route
    fileContent.push(newEntry)
    IoHelper.saveFile(nconf.get('paths:rootInfoFile'), fileContent, (err) ->
      return
    )
  @removeFromRootInfoFile: (route) ->
    fileContent = IoHelper.loadFile(nconf.get('paths:rootInfoFile'))
    _.remove(fileContent, (entry) ->
      entry.url == 'http://$BASEURL$'+route
    )
    IoHelper.saveFile(nconf.get('paths:rootInfoFile'), fileContent)

  @removeFromServiceInfoFile: (route) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    _.remove(content.services,{'path':route})
    IoHelper.saveFile(nconf.get('paths:servicesInfoFile'), content)
    return

  @updateStatus: (identifier, status,route, message) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    if(identifier? and _.find(content.services, {'identifier':identifier})?)
      currentInfo = _.find(content.services, {'identifier':identifier})
    else if(route? and _.find(content.services, {'path':route})?)
      currentInfo = _.find(content.services,{'path':route})

    switch status
      when 'creating'
        currentInfo.status.statusCode = 100
        currentInfo.status.statusMessage = 'Building Algorithm Image'
      when 'testing'
        currentInfo.status.statusCode = 110
        currentInfo.status.statusMessage = 'Testing Algorithm'
      when 'ok'
        currentInfo.status.statusCode = 200
        currentInfo.status.statusMessage = 'Algorithm is Available'
      when 'error'
        currentInfo.status.statusCode = 500
        currentInfo.status.statusMessage = 'Error: ' + message
      when 'delete'
        currentInfo.status.statusCode = 410
        currentInfo.status.statusMessage = 'This Algorithm is no longer available'

    IoHelper.saveFile(nconf.get('paths:servicesInfoFile'), content)
    return

  @updateRoute: (identifier, newRoute) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    if(identifier? and _.find(content.services, {'identifier':identifier})?)
      currentInfo = _.find(content.services, {'identifier':identifier})
    currentInfo.path = newRoute
    IoHelper.saveFile(nconf.get('paths:servicesInfoFile'), content)
    return

  @addUrlParameter: (identifier, parameterName) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    if(identifier? and _.find(content.services, {'identifier':identifier})?)
      currentInfo = _.find(content.services, {'identifier':identifier})
    info = {}
    exists = false
    _.forEach(currentInfo.parameters, (value, key) ->
      if _.has(value,parameterName)
        exists = true
    )

    if not exists
      info[parameterName] = 'url'
      currentInfo.parameters.unshift(info)
    IoHelper.saveFile(nconf.get('paths:servicesInfoFile'), content)
    return


  @addRemotePath: (identifier, parameterName, remotePath) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    if(identifier? and _.find(content.services, {'identifier':identifier})?)
      currentInfo = _.find(content.services, {'identifier':identifier})
    info = {}
    exists = false
    _.forEach(currentInfo.remotePaths, (value, key) ->
      if _.has(value,parameterName)
        exists = true
    )

    if not exists
      info[parameterName] = remotePath
      currentInfo.remotePaths.push(info)
    IoHelper.saveFile(nconf.get('paths:servicesInfoFile'), content)
    return


  @recordException: (identifier, exception) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    if(identifier? and _.find(content.services, {'identifier':identifier})?)
      currentInfo = _.find(content.services, {'identifier':identifier})
    exception =
      date: new Date().toJSON()
      errorMessage: exception
    currentInfo.exceptions.push(exception)
    IoHelper.saveFile(nconf.get('paths:servicesInfoFile'), content)

  @getExceptions: (identifier) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    if(identifier? and _.find(content.services, {'identifier':identifier})?)
      currentInfo = _.find(content.services, {'identifier':identifier})
    return currentInfo.exceptions


  #TODO MAKE CHANGES FOR DOCKER OR CREATE A SEPERATE METHOD
  @updateServicesFile: (newAlgorithm, identifier, route, imageName) ->
    ServicesInfoHelper.reload()
    if(not @getStatusByIdentifier(identifier)? and not @getStatusByRoute(route)?)
      newContent = _.cloneDeep(ServicesInfoHelper.fileContent)
      parameters = []
      _.forEach(newAlgorithm.input, (input, key) ->
        inputType = _.keys(input)[0]
        key = _.get(newAlgorithm, 'input[' + key + '].'+inputType+'.name', inputType)
        info = {}
        info[key] = inputType
        parameters.push(info)
      )
      newServiceEntry =
        service: route.replace(/\//g, '').toLowerCase()
        identifier: identifier
        path: '/'+route
        executablePath: '/data/executables/' + route + path.sep + newAlgorithm.method.executable_path
        programType: newAlgorithm.method.language
        allowParallel: true
        output: 'file'
        execute: 'docker'
        executableType: newAlgorithm.method.executableType
        image_name: imageName
        parameters: parameters
        remotePaths: []
        status:
          statusCode: -1
          statusMessage: ''
        statistics:
          runtime: -1
          executions: 0
        exceptions: []

      newContent.services.push(newServiceEntry)
      ServicesInfoHelper.update(newContent)
      ServicesInfoHelper.reload()

  @updateIdentifier: (route, newIdentifier) ->
    content = IoHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    service = _.find(content.services, ('path':route))
    service.identifier = newIdentifier
    ServicesInfoHelper.update(content)
    ServicesInfoHelper.reload()

module.exports = AlgorithmManagement