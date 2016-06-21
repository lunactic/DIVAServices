# NoResultHandler
# =======
#
# **NoResultHandler** handles methods who don't want to save results

fs = require 'fs'
logger = require '../../logging/logger'

noResultHandler = exports = module.exports = class NoResultHandler
  @filename: ''
  constructor: (filepath) ->
    @filename = filepath

  handleResult: (error, stdout, stderr, process, callback) ->
    if stderr.length > 0
      err =
        statusText: stderr
        status: 500
      callback err, null, process.id
    else
      #delete the result file as it is not needed
      fs.unlinkSync(@filename)
      callback null, null, null