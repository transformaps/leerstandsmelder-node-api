'use strict';

var mongoose = require('mongoose'),
    Promise = require('bluebird'),
    aclManager = require('../lib/auth/acl-manager'),
    rHandler = require('../lib/util/response-handlers');

class CommonController {
    constructor() {

        function deleteProtected(req) {
            delete req.body.region_uuid;
            delete req.body.user_uuid;
            delete req.body.legacy_id;
        }

        this.coroutines = {
            findResource: {
                main: Promise.coroutine(function* (req, res, next, config) {
                    if (req.params.uuid === 'me' && req.user) {
                        req.params.uuid = req.user.uuid;
                    }
                    let query = require('../lib/util/query-mapping')({}, req, config);

                    let paths = mongoose.model(config.resource).schema.paths;
                    if (paths.hasOwnProperty('hide')) {
                        query.hide = false;
                    }

                    let q = mongoose.model(config.resource).find(query);
                    q = config.select ? q.select(config.select) : q;
                    if (req.params.skip) {
                        q = q.skip(parseInt(req.params.skip));
                    }
                    if (req.params.limit) {
                        q = q.limit(parseInt(req.params.limit));
                    }
                    if (req.params.sort) {
                        q = q.sort(req.params.sort);
                    }
                    let results = yield q.exec();
                    if (results.length > 0 && results[0].user_uuid) {
                        let output = [];
                        return Promise.map(results, function (result) {
                                return mongoose.model('User')
                                    .findOne({uuid: result.user_uuid})
                                    .select('uuid nickname').exec()
                                    .then(function (user) {
                                        if (result) {
                                            result = result.toObject();
                                            result.user = user;
                                            output.push(result);
                                        }
                                    });
                            })
                            .then(function () {
                                rHandler.handleDataResponse(output, 200, res, next);
                            });
                    } else {
                        rHandler.handleDataResponse(results, 200, res, next);
                    }
                }),
                pre: Promise.resolve
            },
            getResource: {
                main: Promise.coroutine(function* (req, res, next, config) {
                    let query = {$or: [{uuid: req.params.uuid}, {slug: req.params.uuid}]},
                        paths = mongoose.model(config.resource).schema.paths;
                    if (paths.hasOwnProperty('hide')) {
                        query.hide = false;
                    }
                    let q = mongoose.model(config.resource).findOne(query);
                    q = config.select ? q.select(config.select) : q;
                    let result = yield q.exec();
                    result = result.toObject();
                    if (result.user_uuid) {
                        result.user = yield mongoose.model('User')
                            .findOne({uuid:result.user_uuid})
                            .select('uuid nickname').exec();
                    }
                    rHandler.handleDataResponse(result, 200, res, next);
                }),
                pre: Promise.resolve
            },
            postResource: {
                main: Promise.coroutine(function* (req, res, next, config) {
                    if (req.user && req.user.uuid) req.body.user_uuid = req.user.uuid;
                    if (req.body.hasOwnProperty('region_uuid')) {
                        if (req.body.region_uuid === '685a415a-b1b9-4d1a-9c18-85a0fb30b7e8') {
                            req.body.hidden = true;
                        }
                    }
                    let result = yield mongoose.model(config.resource).create(req.body);
                    yield aclManager.setAclEntry(
                        req.url + '/' + result.uuid,
                        [req.user.uuid, 'admin'],
                        ['get', 'put', 'delete']
                    );
                    yield aclManager.setAclEntry(req.url + '/' + result.uuid, ['user'], ['get']);
                    rHandler.handleDataResponse(result, 201, res, next);
                }),
                pre: Promise.resolve
            },
            putResource: {
                main: Promise.coroutine(function* (req, res, next, config) {
                    let data = yield mongoose.model(config.resource).findOne({uuid: req.params.uuid}).exec();
                    if (data) {
                        for (var key in req.body) {
                            if (data[key]) {
                                data[key] = req.body[key];
                            }
                        }
                        yield data.save();
                        rHandler.handleDataResponse(data, 200, res, next);
                    } else {
                        rHandler.handleErrorResponse(new restify.NotFoundError(), res, next);
                    }
                }),
                pre: Promise.resolve
            },
            delResource: {
                main: Promise.coroutine(function* (req, res, next, config) {
                    let result = yield mongoose.model(config.resource).findOneAndRemove({uuid: req.params.uuid});
                    yield aclManager.removeAclEntry(req.url, req.user.uuid, '*');
                    yield aclManager.removeAclEntry(req.url, 'admin', '*');
                    yield aclManager.removeAclEntry(req.url, 'user', '*');
                    rHandler.handleDataResponse(result, 200, res, next);
                }),
                pre: Promise.resolve
            }
        };
    }

    map(verb, config) {
        let instance = this;
        return function executeRequest(req, res, next) {
            return Promise.resolve()
                .then(() => {
                    return instance.coroutines[`${verb}Resource`].pre(req, res, next, config);
                })
                .then(() => {
                    return instance.coroutines[`${verb}Resource`].main(req, res, next, config);
                })
                .catch(err => {
                    rHandler.handleErrorResponse(err, res, next);
                });
        };
    }
}

module.exports = CommonController;