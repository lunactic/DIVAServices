_         = require 'lodash'
fs        = require 'fs'
IoHelper  = require '../helper/ioHelper'
nconf     = require 'nconf'
request   = require 'request'
util      = require 'util'


class Swagger

  currentSwagger = IoHelper.loadFile(nconf.get('paths:swaggerFile'))

  @createEntry: (algorithmInfo, route) ->
    inputs = _.filter(algorithmInfo.input, (input) ->
      return input[_.keys(input)[0]].userdefined
    )

    names = []
    inputProps = {}
    _.forEach(inputs, (input) ->
      switch _.keys(input)[0]
        when 'select'
          inputProps[input[_.keys(input)[0]].name] =
            type: 'string'
            enum: input.select.options.values
            default: input.select.options.values[input.select.options.default]

        when 'text'
          minLength = input.text.options.min?
          maxLength = input.text.options.max?

          inputProps[input[_.keys(input)[0]].name] =
            type: 'string'
            default: input.text.options.default

          if minLength?
            inputProps[input[_.keys(input)[0]].name]['minLength'] = minLength
          if maxLength?
            inputProps[input[_.keys(input)[0]].name]['maxLength'] = maxLength

        when 'number'
          min = input.number.options.min?
          max = input.number.options.max?

          inputProps[input[_.keys(input)[0]].name] =
            type: 'number'
            default: input.number.options.default

          if min?
            inputProps[input[_.keys(input)[0]].name]['min'] = min
          if max?
            inputProps[input[_.keys(input)[0]].name]['max'] = max

      names.push(input[_.keys(input)[0]].name)
    )
    jsonInputs =
      type: 'object'
      required: names
      properties: inputProps

    definitions =
      type: 'object'
      required: ['inputs', 'highlighter', 'images']
      properties:
        inputs: jsonInputs
        highlighter:
          type: 'object'
        images:
          $ref: '#/definitions/inputImages'

    entry =
      get:
        description: 'get method information'
        produces: ['application/json']
        tags: ['methods']
        parameters: []
        responses:
          200:
            description: "method information"
            schema:
              $ref: 'http://$BASEURL$/schemas/details'
      post:
        description: 'execute method'
        produces: ['application/json']
        tags: ['methods']
        parameters: [
          {
            name: 'execution parameters'
            in: 'body'
            description: 'needed execution parameters'
            required: true
            schema:
              $ref: '#/definitions/'+algorithmInfo.general.name.replace(/\s/g,'').toLowerCase()
          }
        ]
        responses:
          202:
            description: 'start execution response'
            schema:
              $ref: '#/definitions/startExecution'

    currentSwagger.paths['/'+route] = entry
    currentSwagger.definitions[algorithmInfo.general.name.replace(/\s/g,'').toLowerCase()] = definitions
    IoHelper.saveFile(nconf.get('paths:swaggerFile'), currentSwagger, () -> )

module.exports = Swagger