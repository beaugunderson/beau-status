'use strict';

var async = require('async');
var google = require('googleapis');
var gmail = google.gmail('v1');

var client = new google.auth.OAuth2(process.env.CLIENT_ID,
                                    process.env.CLIENT_SECRET);

exports.init = function (cb) {
  client.setCredentials({
    access_token: process.env.ACCESS_TOKEN,
    refresh_token: process.env.REFRESH_TOKEN,
    expiry_date: true
  });

  client.refreshAccessToken(function (err, tokens) {
    if (err) {
      throw err;
    }

    client.setCredentials(tokens);

    cb();
  });
};

google.options({auth: client});

exports.status = function (cb) {
  async.parallel({
    read: function (cbParallel) {
      query('in:inbox is:read', cbParallel);
    },
    unread: function (cbParallel) {
      query('in:inbox is:unread', cbParallel);
    },
    profile: function (cbParallel) {
      gmail.users.getProfile({
        userId: 'me',
        fields: 'messagesTotal,threadsTotal'
      }, function (err, result) {
        cbParallel(err, result);
      });
    }
  }, cb);
};

function query(q, cb) {
  gmail.users.threads.list({
    userId: 'me',
    includeSpamTrash: false,
    q: q,
    fields: 'resultSizeEstimate'
  }, function (err, result) {
    if (err) {
      return cb(err);
    }

    cb(err, result.resultSizeEstimate);
  });
}
