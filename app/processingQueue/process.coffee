#Class representing a process to be executed

process = exports = module.exports = class Process
  @req: null
  @method: ""
  @imagePath: ""
  @imageFolder: ""
  @neededParameters: null
  @inputParameters: null
  @inputHighlighters: null
  @parameters: null
  @results: ""
  @programType: ""
  @executablePath: ""
  @resultHandler: null
  @resultType: ""
  @filePath: ""
  @tmpFilePath: ""
  @requireOutputImage: true
  @inputImageUrl: ""
  @outputImageUrl: ""
  @resultLink: ""
  @data: null
