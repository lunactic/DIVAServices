# GetHandler
# =======
#
# **GetHandler** is responsible for handling all incoming GET requests.
# It responds with the JSON informatio as defined in
# ```server.XXX.json['paths']['jsonPath']/req.originalUrl/info.json``` file
# This means a GET request to /segmentation/textline/hist will return the JSON information in the file
# /data/json/segmentation/textline/hist/info.json.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 licensed.
fs    = require 'fs'
nconf = require 'nconf'

#Expose getHandler
getHandler = exports = module.exports = class GetHandler

  constructor: () ->

  # Handle Incoming GET Requests
  handleRequest: (req, res, callback) ->
    fs.readFile nconf.get('paths:jsonPath') + req.originalUrl + '/info.json', 'utf8', (err, data) ->
      if err
        callback err
      else
        callback null, data
      return
    return
