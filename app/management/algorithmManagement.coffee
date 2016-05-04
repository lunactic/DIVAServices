_                   = require 'lodash'
crypto              = require 'crypto'
IoHelper            = require '../helper/ioHelper'
logger              = require '../logging/logger'
mkdirp              = require 'mkdirp'
nconf               = require 'nconf'
path                = require 'path'
ServicesInfoHelper  = require '../helper/servicesInfoHelper'

algorithmManagement = exports = module.exports = class AlgorithmManagement

  @ioHelper = new IoHelper()



  @updateStatus: (identifier, status,route, message) ->
    content = @ioHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    currentInfo = {}
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

    @ioHelper.saveFile(nconf.get('paths:servicesInfoFile'), content)
    return


  @getStatusByIdentifier: (identifier) ->
    content = @ioHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    status = _.find(content.services, {'identifier':identifier}).status
    if(status?)
      return status
    else
      return {
        statusCode: 404,
        statusText: 'Algorithm with ' + identifier + ' not available'
      }

  @getStatusByRoute: (route) ->
    content = @ioHelper.loadFile(nconf.get('paths:servicesInfoFile'))
    status = _.find(content.services, ('path':route))
    if(status?)
      return status
    else
      return null

  @createIdentifier: () ->
    current_date = (new Date).valueOf().toString()
    random = Math.random().toString()
    return crypto.createHash('sha1').update(current_date + random).digest 'hex'

  @generateUrl: (newAlgorithm) ->
    return newAlgorithm.info.type + '/' + newAlgorithm.name.replace(/\s/g, '').toLowerCase()

  @generateFolders: (route) ->
    mkdirp.sync('/data/executables/' + route)
    mkdirp.sync('/data/json/' + route)
    return

  @createInfoFile: (newAlgorithm, folder) ->
    data = _.cloneDeep(newAlgorithm)
    reservedWords = _.clone(nconf.get('reservedWords'))
    _.remove(reservedWords, (word) ->
      return (word is 'highlighter')
    )
    _.unset(data, 'output')
    _.unset(data, 'file')
    _.unset(data, 'language')
    _.unset(data, 'executable')
    _.unset(data, 'base_image')
    _.unset(data, 'image_name')
    _.remove(data.input, (input) ->
      return _.includes(reservedWords, _.keys(input)[0])
    )

    @ioHelper.saveFile(folder + path.sep + 'info.json', data, (err) ->
      if(err)
        logger.log 'error', err
      else
        return
    )
  @deleteInfoFile: (folder) ->
    @ioHelper.deleteFile(folder + path.sep + 'info.json')

  @updateRootInfoFile: (newAlgorithm, route) ->
    fileContent = @ioHelper.loadFile(nconf.get('paths:rootInfoFile'))
    newEntry =
      name: newAlgorithm.name
      description: newAlgorithm.description
      type: newAlgorithm.namespace
      url: 'http://$BASEURL$/' + route
    fileContent.push(newEntry)
    @ioHelper.saveFile(nconf.get('paths:rootInfoFile'), fileContent, (err) ->
      return
    )
  @removeFromRootInfoFile: (route) ->
    fileContent = @ioHelper.loadFile(nconf.get('paths:rootInfoFile'))
    _.remove(fileContent, (entry) ->
      entry.url == 'http://$BASEURL$'+route
    )
    @ioHelper.saveFile(nconf.get('paths:rootInfoFile'), fileContent)


  #TODO MAKE CHANGES FOR DOCKER OR CREATE A SEPERATE METHOD
  @updateServicesFile: (newAlgorithm, identifier, route) ->
    newContent = _.cloneDeep(ServicesInfoHelper.fileContent)
    parameters = {}
    _.forEach(newAlgorithm.input, (input, key) ->
      inputType = _.keys(input)[0]
      _.set(parameters,_.get(newAlgorithm, 'input[' + key + '].'+inputType+'.name', inputType),'')
    )
    newServiceEntry =
      service: newAlgorithm.name.replace(/\s/g, '').toLowerCase()
      identifier: identifier
      path: '/'+route
      executablePath: '/data/executables/' + route + path.sep + newAlgorithm.executable
      programType: newAlgorithm.language
      allowParallel: true
      output: 'file'
      execute: 'docker'
      image_name: newAlgorithm.image_name
      parameters: parameters
      status:
        statusCode: -1
        statusMessage: ''

    newContent.services.push(newServiceEntry)
    ServicesInfoHelper.update(newContent)
    ServicesInfoHelper.reload()