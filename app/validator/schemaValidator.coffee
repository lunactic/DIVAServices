nconf = require 'nconf'
Validator = require('jsonschema').Validator
validator = new Validator

schemaValidator = exports = module.exports = {}

schemaValidator.validate = (input, schema, callback) ->
  errors = validator.validate(input, nconf.get(schema)).errors
  if errors.length
    error =
      statusCode: 500
      statusText: errors[0].stack
    callback error
  else
    callback null

  