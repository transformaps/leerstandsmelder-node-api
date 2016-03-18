'use strict';

var mongoose = require('mongoose'),
    config = require('../lib/config'),
    Schema = mongoose.Schema,
    Photo = new Schema({

        uuid: {type: String, unique: true},
        location_uuid: {type: String, required: true},
        user_uuid: {type: String, index: true, required: true},
        creator_uuid: {type: String, index: true, required: true},
        publisher_uuid: {type: String, index: true, required: true},
        rights_holder_uuid: {type: String, index: true, required: true},
        filename: {type: String, required: true},
        extension: {type: String, required: true},
        mime_type: {type: String, required: true},
        filehash: {type: String, required: true},
        size: {type: Number, required: true},
        legacy_id: String,
        position: Number,

        created: Date,
        updated: Date

    }, {
        toObject: {virtuals: true},
        toJSON: {virtuals: true},
        autoindex: process.env.NODE_ENV !== 'production',
        id: false
    });

Photo.virtual('original_url').get(function () {
    return `${config.get.file_delivery.base_url}/photos/${this.uuid}.${this.extension}`;
});

Photo.virtual('thumb_url').get(function () {
    return `${config.get.file_delivery.base_url}/photos/${this.uuid}.${this.extension}`;
});

module.exports.Photo = require('../lib/util/model-helper').setup(Photo);