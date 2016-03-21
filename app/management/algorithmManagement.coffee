_ = require 'lodash'
IoHelper = require '../helper/ioHelper'
logger = require '../logging/logger'
mkdirp = require 'mkdirp'
nconf = require 'nconf'
path = require 'path'
ServicesInfoHelper = require '../helper/servicesInfoHelper'

algorithmManagement = exports = module.exports = class AlgorithmManagement

  @generateUrl: (newAlgorithm) ->
    return newAlgorithm.namespace + '/' + newAlgorithm.name.replace(/\s/g, '').toLowerCase()

  @generateFolders: (route) ->
    mkdirp.sync('/data/executables/' + route)
    mkdirp.sync('/data/json/' + route)
    return

  @createInfoFile: (newAlgorithm, folder) ->
    ioHelper = new IoHelper()
    data = _.cloneDeep(newAlgorithm)
    reservedWords = _.remove(nconf.get('reservedWords'), (word) ->
      return not (word is 'highlighter')
    )
    _.unset(data, 'output')
    _.unset(data, 'file')
    _.unset(data, 'language')
    _.unset(data, 'executable')
    data.input = _.remove(data.input, (input) ->
      return not _.includes(reservedWords, _.keys(input)[0])
    )

    ioHelper.saveFile(folder + path.sep + 'info.json', data, (err) ->
      if(err)
        logger.log 'error', err
      else
        return
    )


  @updateRootInfoFile: (newAlgorithm, route) ->
    ioHelper = new IoHelper()
    fileContent = ioHelper.loadFile(nconf.get('paths:jsonPath') + path.sep + 'info.json')
    newEntry =
      name: newAlgorithm.name
      description: newAlgorithm.description
      type: newAlgorithm.namespace
      url: 'http://$BASEURL$/' + route
    fileContent.push(newEntry)
    ioHelper.saveFile(nconf.get('paths:jsonPath') + path.sep + 'info.json', fileContent, (err) ->
      return
    )

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
      output: newAlgorithm.output
      execute: 'local'
      parameters: parameters
    newContent.services.push(newServiceEntry)
    ServicesInfoHelper.update(newContent)
    ServicesInfoHelper.reload()