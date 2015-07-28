# Statistics
# ======
#
# **Statistics** makes use of [process -> hrtime](http://nodejs.org/docs/v0.8.0/api/all.html#all_process_hrtime)
# to record processing times.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 Licensed.

# Module dependencies
nconf       = require 'nconf'
logger      = require '../logging/logger'

statistics = exports = module.exports = class Statistics

  constructor ->
    startTime = 0

  startTime = 0
  startRecording: () ->
    startTime = process.hrtime()

  endRecording: () ->
    endTime = process.hrtime(startTime)
    return endTime[0]
