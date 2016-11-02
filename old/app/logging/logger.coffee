# Logger
# ======
#
# **Logger** makes use of [Log4js](http://stritti.github.io/log4js/docu/users-guide.html)
# to abstract the logging functionality.
#
# Copyright &copy; Marcel Würsch, GPL v3.0 Licensed.

# Module dependencies
log4js      = require 'log4js'
nconf       = require 'nconf'

# Load loggers defined in `./web/conf/server.[dev/prod].json`
log4js.configure appenders: nconf.get 'logger:appenders'
logger = log4js.getLogger 'server'
logger.setLevel nconf.get 'logger:level'

# ---
# **exports.log**</br>
# Expose log method</br>
# `params:`
#   * *level* `<String>` must be one of [fatal, error, warn, info, debug, trace, all]
#   * *msg* `<String>` the message to log
#   * *module* `<String>` (optional) which module sent the log message
exports.log = (level, msg, module) ->
  level = level || 'info'

  if module?
    logger[level] msg + " [#{module}]"
  else
    logger[level] msg

exports.logRequest = (req) ->
  ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  logger['info'] ip + ';' + req.method + ';' + req.originalUrl