
/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/express/express.d.ts" />

var fs = require('fs');

function GetHandler(){};

/* Handle Incoming GET Requests */
GetHandler.prototype.handleRequest = function(req, res, next){
    fs.readFile('/data/json' + req.originalUrl + '/info.json', 'utf8', function (err, data) {
    if (err) {
      next(err);
    }else{
    res.json(JSON.parse(data));
    next();
    }
  }); 
};
module.exports = GetHandler;

