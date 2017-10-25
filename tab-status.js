var process = require('process');
var request = require('request');

var USERNAME = process.env.COUCH_USERNAME;
var PASSWORD = process.env.COUCH_PASSWORD;

module.exports = function (cb) {
  request.get({
    auth: {
      user: USERNAME,
      password: PASSWORD
    },
    url: 'http://localhost:5984/beau-tabs/_changes?descending=true&limit=1&include_docs=true',
    json: true
  }, function (err, response, body) {
    cb(err, body.results[0].doc);
  });
};
