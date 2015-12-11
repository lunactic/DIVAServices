#Class representing a process to be executed

process = exports = module.exports = class Process
  @req: null
  @md5: ""
  @method: ""
  @imagePath: ""
  @imageFolder: ""
  @neededParameters: null
  @inputParameters: null
  @inputHighlighters: null
  @parameters: null
  @result: ""
  @programType: ""
  @executablePath: ""
  @resultHandler: null
  @resultType: ""
  @filePath: ""
  @tmpFilePath: ""
  @requireOutputImage: true
  @inputImageUrl: ""
  @outputImageUrl: ""
  @result: null
  @resultLink: ""
  @data: null
