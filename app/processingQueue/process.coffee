#Class representing a process to be executed

process = exports = module.exports = class Process
  @id: ""
  @req: null
  @method: ""
  @image: null
  @rootFolder: ""
  @outputFolder: ""
  @methodFolder: ""
  @neededParameters: null
  @inputParameters: null
  @inputHighlighters: null
  @inputFolder: ""
  @parameters: null
  @programType: ""
  @executablePath: ""
  @resultHandler: null
  @resultType: ""
  @resultFile: ""
  @tmpResultFile: ""
  @requireOutputImage: true
  @inputImageUrl: ""
  @outputImageUrl: ""
  @result: null
  @resultLink: ""
  @data: null
  @remoteResultUrl: ""
