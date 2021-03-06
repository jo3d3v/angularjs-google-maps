/* jshint node: true */
'use strict';

var pjson = require('./package.json');
var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var stripDebug = require('gulp-strip-debug');
var gutil = require('gulp-util');
var clean = require('gulp-clean');
var runSequence = require('run-sequence');
var tap = require('gulp-tap');
var karma = require('karma');
var connect = require('gulp-connect');
var gulpProtractor = require("gulp-protractor").protractor;
var File = require('vinyl');
var through = require('through2');
var path = require('path');
var cheerio = require('cheerio');
var argv = require('yargs').argv;
var replace = require('gulp-replace');
var umd = require('gulp-umd');
var child_process = require('child_process');

gulp.task('clean', function () {
    return gulp.src('build')
        .pipe(clean({ force: true }));
});

var license = require('uglify-save-license');

gulp.task('build-js:debug', function () {
    return gulp.src([
        'app.js',
        'controllers/*.js',
        'directives/*.js',
        'filters/*.js',
        'services/*.js'
    ])
        .pipe(concat('ng-map.debug.js'))
        .pipe(replace(/(AngularJS Google Maps)/, '$1 Ver. ' + pjson.version))
        .pipe(gulp.dest('build/scripts'))
        .on('error', gutil.log);
});

gulp.task('build-js:angular', function () {
    return gulp.src(['build/scripts/ng-map.debug.js'])
        .pipe(stripDebug())
        .pipe(concat('ng-map.js'))
        .pipe(umd({
            dependencies:   function (file) {
                return [{
                    name:   'angular',
                    amd:    'angular',
                    cjs:    'angular',
                    global: 'angular',
                    param:  'angular'
                }];
            },
            exports:        function (file) {
                return "'ngMap'";
            },
            //template: umdTemplates.returnExportsNoNamespace.path,
            templateSource: '(function(root, factory) {\r\n' +
                            'if (typeof exports === "object") {\r\n' +
                            'module.exports = factory(<%= cjs %>);\r\n' +
                            '} else if (typeof define === "function" && define.amd) {\r\n' +
                            'define(<%= amd %>, factory);\r\n' +
                            '} else{\r\n' +
                            'factory(<%= global %>);\r\n' +
                            '}\r\n' +
                            '}(this, function(<%= param %>) {\r\n' +
                            '<%= contents %>\r\n' +
                            'return <%= exports %>;\r\n' +
                            '}));'
        }))
        .pipe(gulp.dest('build/scripts'))
        .on('error', gutil.log);
});

gulp.task('build-js:angular-min', function () {
    return gulp.src(['build/scripts/ng-map.js'])
        .pipe(concat('ng-map.min.js'))
        .pipe(uglify({ preserveComments: license }))
        .pipe(gulp.dest('build/scripts'))
        .on('error', gutil.log);
});

gulp.task('build-js:no-dependency', function () {
    return gulp.src(['build/scripts/ng-map.debug.js'])
        .pipe(stripDebug())
        .pipe(concat('ng-map.no-dependency.js'))
        .pipe(umd({
            dependencies:   function (file) {
                return [];
            },
            exports:        function (file) {
                return "'ngMap'";
            },
            //template: umdTemplates.returnExportsNoNamespace.path,
            templateSource: '(function(root, factory) {\r\n' +
                            'if (typeof exports === "object") {\r\n' +
                            'module.exports = factory();\r\n' +
                            '} else if (typeof define === "function" && define.amd) {\r\n' +
                            'define([], factory);\r\n' +
                            '} else{\r\n' +
                            'factory();\r\n' +
                            '}\r\n' +
                            '}(this, function() {\r\n' +
                            '<%= contents %>\r\n' +
                            'return <%= exports %>;\r\n' +
                            '}));'
        }))
        .pipe(gulp.dest('build/scripts'))
        .on('error', gutil.log);
});

gulp.task('build-js', function (callback) {
    return runSequence('build-js:debug', ['build-js:no-dependency', 'build-js:angular'], 'build-js:angular-min', callback);
});

gulp.task('docs', function (done) {
    var winExt = /^win/.test(process.platform) ? '.cmd' : '';
    child_process.spawn(path.resolve(path.join('node_modules', '.bin', 'jsdoc' + winExt)),
        ['-c', 'node_modules/angular-jsdoc/common/conf.json', '-t', 'node_modules/angular-jsdoc/angular-template', '-d', 'build/docs', './README.md', '-r', 'directives', 'services'],
        { stdio: 'inherit' }
    ).once('close', done);
});

gulp.task('build', function (callback) {
    runSequence('clean', 'build-js', 'test', 'docs', 'examples:json', callback);
});

gulp.task('test', function (done) {
    var server = new karma.Server({
        configFile: __dirname + '/config/karma.conf.js',
        singleRun:  true
    }, done);
    server.start();
});

gulp.task('test:server', function () {
    connect.server({
        root: __dirname,
        port: 8888
    });
});

gulp.task('test:e2e', ['test:server'], function () {
    gulp.src([__dirname + "/spec/e2e/*_spec.js"])
        .pipe(gulpProtractor({
            configFile: __dirname + "/config/protractor.conf.js",
            args:       [
                '--baseUrl', 'http://localhost:8888',
                '--files', argv.files
            ]
        }))
        .on('error', function (e) {
            console.log([
                '------------------------------------------------------------------------------------',
                'For first-time user, we need to update webdrivers',
                '$ node_modules/gulp-protractor/node_modules/protractor/bin/webdriver-manager update',
                '------------------------------------------------------------------------------------'
            ].join('\n'));
            throw e;
        })
        .on('end', function () { // when process exits:
            connect.serverClose();
        });
});

gulp.task('examples:json', function () {
    var allExamples = {};
    gulp.src([__dirname + "/testapp/*.html"])
        .pipe(through.obj(
            function (file, encoding, callback) {
                var $ = cheerio.load(file.contents);
                allExamples[path.basename(file.path)] = {
                    path:        path.relative(path.dirname(path.dirname(file.path)), file.path),
                    title:       $('title').html(),
                    description: $('meta[name=description]').attr('content'),
                    keywords:    $('meta[name=keywords]').attr('content')
                };
                callback();
            },
            function (callback) {
                this.push(new File({
                    cwd:      ".",
                    base:     "./",
                    path:     "./all-examples.json",
                    contents: new Buffer(JSON.stringify(allExamples, null, '  '))
                }));
                callback();
            }
        ))
        .pipe(gulp.dest('testapp'));
});
