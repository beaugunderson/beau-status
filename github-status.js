'use strict';

var async = require('async');
var cacheManager = require('cache-manager');
var request = require('request');
var _ = require('lodash');

var diskCache = cacheManager.caching({
  store: require('cache-manager-fs'),
  options: {
    ttl: 60 * 60 * 24,
    maxsize: 32000000,
    path: 'disk-cache',
    preventfill: false
  }
});

var GITHUB_TOKEN = process.env.GITHUB_TOKEN;
var REPO_URL = 'https://api.github.com/user/repos';

function repos(cb) {
  diskCache.wrap('repos', function (cacheCb) {
    var count;
    var page = 1;
    var repositories = [];

    async.until(
      function () {
        return count === 0;
      },
      function (cbUntil) {
        var url = REPO_URL + '?page=' + page + '&per_page=100&access_token=' +
          GITHUB_TOKEN;

        request.get({
          url: url,
          json: true,
          headers: {
            'User-Agent': 'beau-status'
          }
        }, function (err, response, data) {
          if (err) {
            return cbUntil(err);
          }

          count = data.length;

          page++;

          repositories = repositories.concat(data);

          cbUntil();
        });
      }, function (err) {
        cacheCb(err, repositories);
      });
  }, {ttl: 3600}, cb);
}

function processRepositories(data) {
  return _.chain(data)
    .groupBy('language')
    .map(function (value, key) {
      return {name: key, count: value.length, repos: value};
    })
    .sortBy('name')
    .reverse()
    .sortBy('count')
    .reverse()
    .value();
}

exports.status = function (cb) {
  repos(function (err, repositories) {
    if (err) {
      return cb(err);
    }

    _.each(repositories, function (repo) {
      if (!repo.language) {
        repo.language = 'Other';
      }

      // Make sure we don't take credit for forks that didn't happen on GitHub
      if (repo.name === 'libbtbb') {
        repo.fork = true;
      }
    });

    repositories = repositories.map(function (repository) {
      return _.pick(repository, [
        'description',
        'fork',
        'full_name',
        'html_url',
        'language',
        'name'
      ]);
    });

    var mine = repositories.filter(
      (repository) => repository.full_name.startsWith('beaugunderson/'));

    var org = repositories.filter(
      (repository) => !repository.full_name.startsWith('beaugunderson/'));

    var sources = _.reject(mine, 'fork');
    var forks = _.filter(mine, 'fork');

    var data = {
      sources: processRepositories(sources),
      forks: processRepositories(forks),
      org: processRepositories(org),

      total: mine.length,
      sourcesTotal: sources.length,
      forksTotal: forks.length,
      orgTotal: org.length
    };

    cb(null, data);
  });
};
