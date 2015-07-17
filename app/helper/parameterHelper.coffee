nconf   = require 'nconf'
path    = require 'path'


exports.getReservedParamValue = (param, imagePath) ->
  switch param
    when 'matlabPath'
      return nconf.get('paths:matlabPath')
    when 'matlabScriptsPath'
      return nconf.get('paths:matlabScriptsPath')
    when 'inputFileExtension'
      return path.extname imagePath
    when 'image'
      return imagePath
