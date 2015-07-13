
/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/express/express.d.ts" />

var fs = require('fs');

function PostHandler(){};

/* Handle Incoming GET Requests */
PostHandler.prototype.handleRequest = function(req, res, next){
    //fs.readFile('/data/json' + req.originalUrl + '/info.json', 'utf8', function (err, data) {
    var fileContent = JSON.parse(fs.readFileSync('/data/json/services.json', 'utf8'));
    
    var arrayFound = fileContent.services.filter(function(item){
        return item.path === req.originalUrl;
    });
    
    if(typeof arrayFound != 'undefined'){
        //extract image
        
        //perform parameter matching
        console.log(req.body);
        var neededParameters = arrayFound[0].parameters;
        var inputParameters = req.body.inputs;
        var executablePath = arrayFound[0].executablePath;
        //loop through all needed parameters
        for( var parameter in neededParameters){
            //find matching input parameter
            var value = getParamValue(parameter,inputParameters);
            if(typeof value != 'undefined'){
                executablePath += " " + value;
            }
                
        }
        console.log(executablePath);
        res.sendStatus(200);
    }
    
    next();
};

function getParamValue(parameter, inputParameters){
    if(inputParameters.hasOwnProperty(parameter)){
        return inputParameters[parameter];
    }
}


module.exports = PostHandler;

