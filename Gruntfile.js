module.exports = function (grunt) {
    'use strict';
    grunt.initConfig({

        jasmine_node: {
            matchall: true,
            projectRoot: "./test/",
            source: ['index.js', './lib/'],
            forceExit: true,
            keepRunner: true,
            jUnit: {
                report: true,
                savePath : "./dist/reports/jasmine/",
                useDotNotation: true,
                consolidate: false
            }
        },

        jshint: {
            all: [
                'Gruntfile.js',
                'index.js',
                'lib/**/*.js',
                'test/**/*.js'
            ],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        watch: {
            default: {
                files: ['Gruntfile.js', 'index.js', 'lib/**/**/*.js', 'test/**/*.js'],
                tasks: ['test']
            }
        },

        clean: {
            all: ["dist"],
            reports: ["dist/reports/**"]
        },

        release: {
            options: {
                bump: true,
                add: true,
                commit: true,
                tag: true,
                push: true,
                pushTags: true,
                npm: false,
                npmtag: false
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.loadNpmTasks('grunt-jasmine-node');
    grunt.loadNpmTasks('grunt-release');


    grunt.registerTask('test', ['jshint', 'jasmine_node']);
    grunt.registerTask('default', ['test']);

    // Print out what was changed
    grunt.event.on('watch', function (action, filepath) {
        grunt.log.writeln(filepath + ' has ' + action);
    });

};
