'use strict';

var email = require('./email-status.js');
var express = require('express');
var github = require('./github-status.js');
var process = require('process');

var app = express();

app.get('/email/', function (req, res) {
  email.status(function (err, status) {
    if (err) {
      return res.json({error: err});
    }

    res.json(status);
  });
});

app.get('/github/', function (req, res) {
  github.status(function (err, status) {
    if (err) {
      return res.json({error: err});
    }

    res.json(status);
  });
});

email.init(function () {
  app.listen(process.env.PORT);
});
