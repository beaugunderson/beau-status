'use strict';

var async = require('async');
var cacheManager = require('cache-manager');
var request = require('request');
var _ = require('lodash');

var listeners = [];
var isFilled;

exports.filled = (cb) => {
  if (cb && !isFilled) {
    listeners.push(cb);
  } else if (cb) {
    cb();
  } else {
    isFilled = true;

    listeners.forEach((listener) => listener());
  }
};

var diskCache = cacheManager.caching({
  store: require('cache-manager-fs'),
  options: {
    ttl: 60 * 60 * 24,
    maxsize: 32000000,
    path: 'disk-cache',
    fillcallback: exports.filled,
    preventfill: false
  }
});

var GITHUB_TOKEN = process.env.GITHUB_TOKEN;

var API_URL = 'https://api.github.com';
var REPO_URL = `${API_URL}/user/repos`;

function commitsUrl(repo) {
  return `${API_URL}/repos/${repo.full_name}/stats/contributors`;
}

var repoCommits = exports.repoCommits = (repo, cb) => {
  request.get({
    url: commitsUrl(repo),
    json: true,
    qs: {
      access_token: GITHUB_TOKEN
    },
    headers: {
      'User-Agent': 'beau-status'
    },
  },
  (err, response, data) => {
    if (response.statusCode === 202 || err) {
      return cb(err);
    }

    var total = _.sumBy(data, 'total');
    var beau = _.find(data, {author: {login: 'beaugunderson'}});

    var result;

    if (!beau) {
      result = {
        full_name: repo.full_name,
        mine: 0,
        total: total
      };
    } else {
      result = {
        full_name: repo.full_name,
        mine: beau.total,
        total: total,
        percentage: beau.total / total
      };
    }

    console.log('result', result);

    cb(err, result);
  });
};

var repos = exports.repos = function (cb) {
  diskCache.wrap('repos', function (cacheCb) {
    var count;
    var page = 1;
    var repositories = [];

    async.until(
      function () {
        return count === 0;
      },
      function (cbUntil) {
        request.get({
          url: REPO_URL,
          json: true,
          qs: {
            page: page,
            per_page: 100,
            access_token: GITHUB_TOKEN
          },
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
  }, {ttl: 60 * 60 * 24}, cb);
};

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

var commitStats = exports.commitStats = (repositories, cb) => {
  diskCache.wrap('commitStats', function (cacheCb) {
    var data = [];

    var queue = async.queue((task, cbQueue) => {
      console.log(`getting commits for ${task.full_name}`);

      repoCommits(task, (commitsError, commits) => {
        if (commitsError) {
          return cbQueue(commitsError);
        }

        if (!commits) {
          console.log(`queueing ${task.full_name}`);

          setTimeout(() => queue.push(task), 5000);

          return cbQueue();
        }

        commits.full_name = task.full_name;
        commits.name = task.name;

        data.push(commits);

        cbQueue();
      });
    }, 15);

    queue.drain = () => cacheCb(null, data);
    queue.error = (queueError) => cacheCb(queueError);

    repositories.forEach((repo) => queue.push(repo));
  }, {ttl: 60 * 60 * 24 * 7}, cb);
};

function addCommits(repositories, cb) {
  commitStats(repositories, (err, stats) => {
    repositories = repositories.map(
      (repo) => _.merge(repo, _.find(stats, {full_name: repo.full_name})));

    cb(err, repositories);
  });
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

    addCommits(repositories, (addCommitsError, repositories) => {
      if (addCommitsError) {
        return cb(addCommitsError);
      }

      var mine = repositories.filter(
        (repository) => repository.full_name.startsWith('beaugunderson/'));

      var organization = repositories.filter((repository) => {
        return !repository.full_name.startsWith('beaugunderson/') &&
               repository.mine > 0;
      });

      var sources = _.reject(mine, 'fork');
      var forks = _.filter(mine, 'fork');

      var data = {
        sources: processRepositories(sources),
        forks: processRepositories(forks),
        org: processRepositories(organization),

        total: mine.length + organization.length,
        sourcesTotal: sources.length,
        forksTotal: forks.length,
        orgTotal: organization.length,
        totalCommits: _.sumBy(repositories, 'mine')
      };

      cb(null, data);
    });
  });
};
