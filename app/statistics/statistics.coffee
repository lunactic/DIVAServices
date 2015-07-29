# Statistics
# ======
#
# **Statistics** makes use of [process -> hrtime](http://nodejs.org/docs/v0.8.0/api/all.html#all_process_hrtime)
# to record processing times.
# Keeps also track of which methods are currently executed
#
# Copyright &copy; Marcel Würsch, GPL v3.0 Licensed.

# Module dependencies
nconf       = require 'nconf'
fs          = require 'fs'
logger      = require '../logging/logger'


statistics = exports = module.exports = class Statistics

  @currentExecutions = {}
  @currentStatistics = {}
  @startTime = 0

  constructor ->
    startTime = 0

  @startRecording: (reqPath) ->
    @startTime = process.hrtime()
    rand = Math.random()
    @currentExecutions[rand] =
      startTime: @startTime
      path: reqPath

    return rand
  @endRecording: (rand, reqPath) ->
    @endTime = process.hrtime(@currentExecutions[rand].startTime)
    delete @currentExecutions[rand]
    if(@currentStatistics[reqPath]?)
      @currentStatistics[reqPath] =
       runtime: (@currentStatistics[reqPath].runtime + @endTime[0]) / 2
       executions: @currentStatistics[reqPath].executions+1
    else
      @currentStatistics[reqPath] =
        runtime: @endTime[0]
        executions: 1

    console.log JSON.stringify(@currentStatistics)
    return @endTime[0]

  @loadStatistics: () ->
    console.log 'load stats'
    console.log '@currentStatistics: ' + JSON.stringify(@currentStatistics)
    if(Object.keys(@currentStatistics).length is 0)
      try
        @currentStatistics = JSON.parse(fs.readFileSync(nconf.get('paths:statisticsFile'),'utf-8'))
        console.log 'loaded stats'
        console.log JSON.stringify(@currentStatistics)
      catch error
        #
        hould only happen at first startup
        console.info 'No statistics file found'

  @saveStatistics: (callback) ->
    console.log 'saving statistics'
    console.log JSON.stringify(@currentStatistics)
    fs.writeFile nconf.get('paths:statisticsFile'), JSON.stringify(@currentStatistics), (err) ->
      if(err?)
        callback err
      else
        callback null
      return
