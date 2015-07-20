nconf   = require 'nconf'
path    = require 'path'


exports.getReservedParamValue = (parameter, imagePath) ->
  switch parameter
    when 'matlabPath'
      return nconf.get('paths:matlabPath')
    when 'matlabScriptsPath'
      return nconf.get('paths:matlabScriptsPath')
    when 'inputFileExtension'
      return path.extname imagePath
    when 'image'
      return imagePath

exports.getHighlighterParamValues = (neededHighlighter, inputHighlighter, callback) ->
  console.log 'neededHighlighter: ' + neededHighlighter
  console.log 'inputHighlighter: ' + JSON.stringify(inputHighlighter)
  if(neededHighlighter is not inputHighlighter['type'])
    error = []
    error.code = 500
    error.statusText = 'inputHighlighter does not match the requested highlighter from this method.'
    callback error

  switch neededHighlighter
    when 'rectangle'
      console.log inputHighlighter.segments
      merged = []
      merged = merged.concat.apply(merged,inputHighlighter.segments)
      merged = merged.map(Math.round)
      return merged.join(' ')
    when 'circle'
      console.log inputHighlighter.segments
    when 'polygon'
      console.log inputHighlighter.segments
