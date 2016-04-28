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
    content = @ioHelper.loadFile(nconf.get('paths:algorithmStatusFile'))
    currentInfo = {}
    if(identifier? and _.find(content, {'identifier':identifier})?)
      currentInfo = _.find(content, {'identifier':identifier})
    else if(route? and _.find(content, {'route':route})?)
      currentInfo = _.find(content,{'route':route})
    else
      currentInfo =
        identifier: identifier
        statusCode: -1
        statusMessage: ''
        route: route
      content.push currentInfo
    switch status
      when 'creating'
        currentInfo.statusCode = 100
        currentInfo.statusMessage = 'Building Algorithm Image'
      when 'testing'
        currentInfo.statusCode = 110
        currentInfo.statusMessage = 'Testing Algorithm'
      when 'ok'
        currentInfo.statusCode = 200
        currentInfo.statusMessage = 'Algorithm is Available'
      when 'error'
        currentInfo.statusCode = 500
        currentInfo.statusMessage = 'Error: ' + message
    @ioHelper.saveFile(nconf.get('paths:algorithmStatusFile'), content, () ->)


  @getStatus: (identifier) ->
    content = @ioHelper.loadFile(nconf.get('paths:algorithmStatusFile'))
    status = _.find(content, {'identifier':identifier})
    if(status?)
      return status
    else
      return {
        statusCode: 404,
        statusText: 'Algorithm with ' + identifier + ' not available'
      }


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
    reservedWords = _.remove(nconf.get('reservedWords'), (word) ->
      return not (word is 'highlighter')
    )
    _.unset(data, 'output')
    _.unset(data, 'file')
    _.unset(data, 'language')
    _.unset(data, 'executable')
    _.unset(data, 'base_image')
    _.unset(data, 'image_name')
    data.input = _.remove(data.input, (input) ->
      return not _.includes(reservedWords, _.keys(input)[0])
    )

    @ioHelper.saveFile(folder + path.sep + 'info.json', data, (err) ->
      if(err)
        logger.log 'error', err
      else
        return
    )


  @updateRootInfoFile: (newAlgorithm, route) ->
    fileContent = @ioHelper.loadFile(nconf.get('paths:jsonPath') + path.sep + 'info.json')
    newEntry =
      name: newAlgorithm.name
      description: newAlgorithm.description
      type: newAlgorithm.namespace
      url: 'http://$BASEURL$/' + route
    fileContent.push(newEntry)
    @ioHelper.saveFile(nconf.get('paths:jsonPath') + path.sep + 'info.json', fileContent, (err) ->
      return
    )


  #TODO MAKE CHANGES FOR DOCKER OR CREATE A SEPERATE METHOD
  @updateServicesFile: (newAlgorithm, route) ->
    newContent = _.cloneDeep(ServicesInfoHelper.fileContent)
    parameters = {}
    _.forEach(newAlgorithm.input, (input, key) ->
      inputType = _.keys(input)[0]
      _.set(parameters,_.get(newAlgorithm, 'input[' + key + '].'+inputType+'.name', inputType),'')
    )
    newServiceEntry =
      service: newAlgorithm.name.replace(/\s/g, '').toLowerCase()
      path: '/'+route
      executablePath: '/data/executables/' + route + path.sep + newAlgorithm.executable
      programType: newAlgorithm.language
      allowParallel: true
      output: 'file'
      execute: 'docker'
      image_name: newAlgorithm.image_name
      parameters: parameters
    newContent.services.push(newServiceEntry)
    ServicesInfoHelper.update(newContent)
    ServicesInfoHelper.reload()