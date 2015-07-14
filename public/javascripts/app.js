var ImageHelper;

ImageHelper = (function() {
  function ImageHelper() {}

  ImageHelper.prototype.saveImage = function(image) {
    return console.log('saving image');
  };

  return ImageHelper;

})();

module.exports = ImageHelper;
;var GetHandler, fs;

fs = require('fs');

GetHandler = (function() {
  function GetHandler() {}


  /* Handle Incoming GET Requests */

  GetHandler.prototype.handleRequest = function(req, res, next) {
    fs.readFile('/data/json' + req.originalUrl + '/info.json', 'utf8', function(err, data) {
      if (err) {
        next(err);
      } else {
        res.json(JSON.parse(data));
        next();
      }
    });
  };

  return GetHandler;

})();

module.exports = GetHandler;
;var PostHandler, fs, imageHelper;

fs = require('fs');

imageHelper = require('../helper/imageHelper');

PostHandler = (function() {
  var getParamValue;

  function PostHandler() {}

  getParamValue = function(parameter, inputParameters) {
    if (inputParameters.hasOwnProperty(parameter)) {
      return inputParameters[parameter];
    }
  };


  /* Handle Incoming GET Requests */

  PostHandler.prototype.handleRequest = function(req, res, next) {
    var arrayFound, executablePath, fileContent, imgHelper, inputParameters, neededParameters, parameter, value;
    fileContent = JSON.parse(fs.readFileSync('/data/json/services.json', 'utf8'));
    arrayFound = fileContent.services.filter(function(item) {
      return item.path === req.originalUrl;
    });
    if (typeof arrayFound !== 'undefined') {
      imgHelper = new imageHelper();
      imgHelper.saveImage(req.body.image);
      console.log(req.body);
      neededParameters = arrayFound[0].parameters;
      inputParameters = req.body.inputs;
      executablePath = arrayFound[0].executablePath;
      for (parameter in neededParameters) {
        value = getParamValue(parameter, inputParameters);
        if (typeof value !== 'undefined') {
          executablePath += ' ' + value;
        }
      }
      console.log(executablePath);
      res.sendStatus(200);
    }
    next();
  };

  return PostHandler;

})();

module.exports = PostHandler;
;
//# sourceMappingURL=app.js.map