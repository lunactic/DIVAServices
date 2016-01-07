#Class representing a process to be executed

process = exports = module.exports = class Process
  @req: null
  @method: ""
  @image: null
  @rootFolder: ""
  @outputFolder: ""
  @methodFolder: ""
  @neededParameters: null
  @inputParameters: null
  @inputHighlighters: null
  @parameters: null
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
