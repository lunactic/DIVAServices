collection = exports = module.exports = class Collection

  constructor: () ->
    @method = ""
    @name = ""
    @outputLink = ""
    @outputFolder = ""
    @inputParameters = {}
    @inputHighlighters = {}
    @parameters = null
    @processes = []
    @result = null
    @resultFile = ""
    @rootFolder = ""
