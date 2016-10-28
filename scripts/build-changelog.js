'use strict';

var SECTIONS = {
      feat: {
        name: 'Features',
        commits: []
      },
      fix: {
        name: 'Bug Fixes',
        commits: []
      },
      refactor: {
        name: 'Code Refactoring',
        commits: []
      },
      perf: {
        name: 'Performance Improvements',
        commits: []
      }
    },
    VERSION_HEAD_TEMPLATE = [
      '<a name="{tag}"></a>\n',
      '# [{tag}](https://github.com/CodeCorico/{project}/compare/{lastTag}...{tag}) ({date})\n\n'
    ].join(''),
    VERSION_SECTION_TEMPLATE = '### {section}\n',
    VERSION_COMMIT_TEMPLATE = '* **{scope}:** {message} [#{id}](https://github.com/CodeCorico/{project}/commit/{id})\n',

    path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    cwd = path.resolve('./'),
    changelogFile = path.join(cwd, 'CHANGELOG.md'),
    data = {
      date: _date()
    };

function _date() {
  var date = new Date();

  return [date.getFullYear(), _fillDate(date.getMonth() + 1), _fillDate(date.getDate())].join('-');
}

function _fillDate(num) {
  return num < 10 ? '0' + num : num;
}

function _exec(command, emptyMessae) {
  return new Promise(function(resolve) {
    exec(command, {
      cwd: cwd
    }, function(err, stdout, stderr) {
      if (err || stderr || !stdout) {
        return console.log('ERROR:', err || stderr || emptyMessae);
      }

      resolve(stdout);
    });
  });
}

function _package() {
  return new Promise(function(resolve) {
    var packageJSON = require(path.join(cwd, 'package.json'));

    resolve(packageJSON);
  });
}

function _lastCommitId() {
  return _exec('git rev-parse HEAD', 'no last commit ID found');
}

function _lastTag() {
  return _exec('git describe --abbrev=0 --tags', 'no last tag found');
}

function _commits(tagA, tagB) {
  return _exec('git log ' + tagA + '...' + tagB + ' --pretty=format:%H!%s --reverse | grep -v Merge', 'no commits found');
}

_package()
  .then(function(packageJSON) {
    data.project = packageJSON.name;
    data.tag = packageJSON.version;

    return _lastCommitId();
  })
  .then(function(commitId) {
    data.lastCommitId = commitId.replace(/\n/g, '');

    return _lastTag();
  })
  .then(function(lastTag) {
    data.lastTag = lastTag.replace(/\n/g, '');

    return _commits(data.lastTag, data.lastCommitId);
  })
  .then(function(commits) {
    var content = [VERSION_HEAD_TEMPLATE
      .replace(/{lastTag}/g, data.lastTag)
      .replace(/{tag}/g, data.tag)
      .replace(/{project}/g, data.project)
      .replace(/{date}/g, data.date)];

    commits.split('\n').forEach(function(commit) {
      if (!commit) {
        return;
      }

      commit = commit.split('!');

      var commitId = commit.shift(),
          commitMessage = commit.join('!'),
          commitType = commitMessage.split('(').shift();

      commitMessage = commitMessage.split('):');

      var commitScope = commitMessage.shift().split('(')[1];

      commitMessage = commitMessage.join('):').trim();

      if (!SECTIONS[commitType] || commitScope == 'project') {
        return;
      }

      commitId = commitId.substr(0, 7);

      SECTIONS[commitType].commits.push(
        VERSION_COMMIT_TEMPLATE
          .replace(/{lastTag}/g, data.lastTag)
          .replace(/{tag}/g, data.tag)
          .replace(/{project}/g, data.project)
          .replace(/{date}/g, data.date)
          .replace(/{scope}/g, commitScope)
          .replace(/{id}/g, commitId)
          .replace(/{message}/g, commitMessage)
      );
    });

    Object.keys(SECTIONS).forEach(function(type) {
      if (!SECTIONS[type].commits.length) {
        return;
      }

      content.push(VERSION_SECTION_TEMPLATE.replace(/{section}/g, SECTIONS[type].name));

      content = content.concat(SECTIONS[type].commits);
      content.push('\n');
    });

    var changelog = fs.readFileSync(changelogFile, 'utf-8');

    changelog = content.join('') + changelog;

    fs.writeFileSync(changelogFile, changelog);

    console.log('\n  Version ' + data.tag + ' added.');
  });
