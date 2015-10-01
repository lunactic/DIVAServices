#Class representing a process to be executed

process = exports = module.exports = class Process
  @req: null
  @imageHelper: null
  @parameters: null
  @results: ""
  @programType: ""
  @executablePath: ""
  @resultHandler: null
  @resultType: ""
  @filePath: ""
  @tmpFilePath: ""
  @requireOutputImage: true
  @outputImageUrl: ""
  @resultLink: ""

  constructor: () ->
    @requireOutputImage = true