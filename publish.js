'use strict';

/**
 * Modules
 * External
 */
const path = require('path'),
    glob = require('glob'),
    _ = require('lodash'),
    publishRelease = require('publish-release');


/**
 * Modules
 * Internal
 */
const packageJson = require('./package.json');


/**
 * Logger
 */
let log = function() {
    var args = Array.from(arguments);

    var title = args[0],
        text = args.slice(1),
        textList = [];

    for (let value of text) {
        if (_.isPlainObject(value)) {
            textList.push('\r\n' + JSON.stringify(value, null, 4) + '\r\n');
        } else {
            textList.push(value);
        }
    }

    console.log('\x1b[1m%s: %s\x1b[0m', title, textList.join(' '));
};


/**
 * Deployment asset list
 */
let assetList = glob.sync(path.join(path.resolve(packageJson.build.directoryRelease), '*.zip'));


/**
 * Options for publish-release
 */
let createPublishOptions = function() {
    return {
        token: process.env.GITHUB_TOKEN,
        owner: packageJson.author.name,
        repo: packageJson.name,
        tag: 'v' + packageJson.version,
        name: packageJson.build.productName + ' ' + 'v' + packageJson.version,
        notes: packageJson.version,
        draft: false,
        prerelease: false,
        reuseRelease: true,
        reuseDraftOnly: true,
        assets: assetList,
        target_commitish: 'master'
    };
};


/**
 * Start Publishing
 */
publishRelease(createPublishOptions(), function(err, release) {
    if (err) {
        log('Publishing error', err);
        return process.exit(1);
    }

    log('Publishing complete', release);
});