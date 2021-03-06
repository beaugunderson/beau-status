'use strict';

var email = require('./email-status.js');
var express = require('express');
var github = require('./github-status.js');
var process = require('process');
var tabs = require('./tab-status.js');

var app = express();

app.get('/tabs/', function (req, res) {
  tabs(function (err, status) {
    if (err) {
      return res.json({error: err});
    }

    res.json(status);
  });
});

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

app.get('/github/unprocessed/', function (req, res) {
  github.repos(function (err, repos) {
    if (err) {
      return res.json({error: err});
    }

    res.json(repos);
  });
});

email.init(function () {
  app.listen(process.env.PORT);
});
