#!/usr/bin/env node

'use strict';

var Promise = require('bluebird'),
    mongoose = require('mongoose'),
    config = require('../lib/config'),
    workers = require('../lib/workers');

mongoose.Promise = Promise;

Promise.coroutine(function* () {
    yield config.load();
    var resources = [
            {res: 'Photo', path: '/photos', model: require('../models/photo').Photo}
        ],
        dburl = 'mongodb://' +
            config.get.mongodb.host + ':' +
            config.get.mongodb.port + '/' +
            config.get.mongodb.dbname;

    mongoose.connect(dburl);
    mongoose.model('Photo', require('../models/photo').Photo);

    console.log('connecting to ' + dburl);

    return Promise.resolve(mongoose.model('Photo').find({}))
        .map(function (photo) {
            return Promise.promisify(function (cb) {
                    setTimeout(cb, 1000);
                })()
                .then(function () {
                    return workers.createThumbnails(photo, 0);
                });
        }, {concurrency: 1});
})();