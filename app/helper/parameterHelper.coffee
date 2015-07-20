nconf   = require 'nconf'
path    = require 'path'


exports.getReservedParamValue = (parameter, imagePath) ->
  switch parameter
    when 'matlabPath'
      return nconf.get('paths:matlabPath')
    when 'matlabScriptsPath'
      return nconf.get('paths:matlabScriptsPath')
    when 'inputFileExtension'
      return path.extname(imagePath).slice(1)
    when 'image'
      return imagePath
    when 'outputFolder'
      return path.dirname(imagePath)

###
 Gets Parameter values for highlighters.
 The values will be as follow:
  for 'rectangle':
    topLeft.x topLeft.y topRight.x topRight.y bottomRight.x bottomRight.y bottomLeft.x bottomRight.y
  for 'circle':
    position.x position.y radius
  for 'polygon'
    point1.x point1.y point2.x point2.y, ..., pointN.x, pointN.y
###
exports.getHighlighterParamValues = (neededHighlighter, inputHighlighter, callback) ->
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
      position = inputHighlighter.position
      position = position.map(Math.round)
      radius = inputHighlighter.radius
      radius = Math.round(radius)
      return position[0] + ' ' + position[1] + ' ' + radius
    when 'polygon'
      merged = []
      merged = merged.concat.apply(merged, inputHighlighter.segments)
      merged = merged.map(Math.round)
      return merged.join(' ')
