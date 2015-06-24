/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/express/express.d.ts" />

var express = require('express');
var fs = require('fs');
var router = express.Router();


/* GET home page. */
router.get('*', function (req, res, next) {
  fs.readFile('/data/json' + req.originalUrl + '/info.json', 'utf8', function (err, data) {
    if (err) {
      var errMessg = new Error('Not Found');
      errMessg.status = 404;
      next(errMessg);
    }
    res.json(JSON.parse(data));
  });
});

module.exports = router;
