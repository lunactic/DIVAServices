fs    = require 'fs'
path  = require 'path'
_     = require 'lodash'
randomWordGenerator = exports = module.exports = class RandomWordGenerator

  @rootDir ?= rootDir = path.resolve(__dirname, '../..','words')
  @adjectives ?= fs.readFileSync(rootDir + '/adjectives','utf8').toString().split("\n")
  @animals ?= fs.readFileSync(rootDir + '/animals','utf8').toString().split("\n")

  @generateRandomWord: () ->
    return _.sample(@adjectives) + _.sample(@adjectives) + _.sample(@animals)


