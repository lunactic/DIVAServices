#/ <reference path="../typings/node/node.d.ts"/>
#/ <reference path="../typings/express/express.d.ts" />
fs = require('fs')

class GetHandler
  constructor: () ->

  ### Handle Incoming GET Requests ###
  handleRequest: (req, res) ->
    fs.readFile '/data/json' + req.originalUrl + '/info.json', 'utf8', (err, data) ->
      if err
        next err
      else
        res.json JSON.parse(data)
      return
    return

module.exports = GetHandler
