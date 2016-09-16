collection = exports = module.exports = class Collection

  constructor: () ->
    @method = ""
    @name = ""
    @outputLink = ""
    @outputFolder = ""
    @inputParameters = {}
    @inputHighlighters = {}
    @neededParameters = {}
    @parameters = null
    @image = {}
    @processes = []
    @result = null
    @resultFile = ""
    @rootFolder = ""

    @hasFiles = false
    @hasImages = false
