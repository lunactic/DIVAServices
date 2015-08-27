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

  @currentExecutions = []
  @currentStatistics = {}
  @startTime = 0

  constructor ->
    startTime = 0

  @isRunning :(reqPath) ->
    executionInfo = @currentExecutions.filter (x) -> x.path == reqPath
    return executionInfo.length > 0

  @startRecording: (reqPath) ->
    logger.log 'info', 'reqPath: ' + reqPath
    @startTime = process.hrtime()
    rand = Math.random()
    @currentExecutions.push({
      rand : rand
      startTime: @startTime
      path: reqPath
    })
    return rand

  @endRecording: (rand, reqPath) ->
    executionInfo = @currentExecutions.filter (x) -> x.rand == rand
    @endTime = process.hrtime(executionInfo[0].startTime)
    delete @currentExecutions[rand]
    if(@currentStatistics[reqPath]?)
      @currentStatistics[reqPath] =
       runtime: (@currentStatistics[reqPath].runtime + @endTime[0]) / 2
       executions: @currentStatistics[reqPath].executions+1
    else
      @currentStatistics[reqPath] =
        runtime: @endTime[0]
        executions: 1
    #remove the call from current executions
    @currentExecutions = @currentExecutions.filter (x) -> x.rand == rand
    return @endTime[0]

  @getMeanExecutionTime: (reqPath) ->
    if(@currentStatistics[reqPath]?)
      return @currentStatistics[reqPath].runtime
    else
      return 'No runtime information available'
  @loadStatistics: () ->
    if(Object.keys(@currentStatistics).length is 0)
      try
        @currentStatistics = JSON.parse(fs.readFileSync(nconf.get('paths:statisticsFile'),'utf-8'))
      catch error
        #Should only happen at first startup
        logger.log 'error', 'No statistics file found'
  @saveStatistics: (callback) ->
    fs.writeFile nconf.get('paths:statisticsFile'), JSON.stringify(@currentStatistics), (err) ->
      if(err?)
        callback err
      else
        callback null
      return
