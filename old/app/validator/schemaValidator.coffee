nconf = require 'nconf'
Validator = require('jsonschema').Validator
validator = new Validator
logger = require '../logging/logger'

schemaValidator = exports = module.exports = {}

schemaValidator.validate = (input, schema, callback) ->
  try
    errors = validator.validate(input, nconf.get(schema)).errors
    if errors.length
      error =
        statusCode: 500
        errorType: 'validation error'
        statusText: errors[0].stack
      callback error
    else
      callback null
  catch error
    logger.log 'error', error

  