# Config
# ======
#
# **Config** is the configuration file for [Brunch](http://brunch.io/).
# See docs at `https://github.com/brunch/brunch/blob/stable/docs/config.md`
#
# Copyright &copy; Marcel Würsch, GPL v3.0 Licensed.

# Expose brunch settings
brunchSettings = exports = module.exports = {}

# Brunch configurations
brunchSettings.config =

  modules:
    definition: false
    wrapper: false

  sourceMaps: true

  files:
    javascripts:
      defaultExtension: 'coffee'
      joinTo:
        'javascripts/app.js': /^app/
        'javascripts/vendor.js': /^(vendor|bower_components)/
      order:
        before: [
          'app/**/*.coffee'
          ]
        after: [
        ]

  conventions:

    ignored: /^(vendor\/styles\/smartadmin\/)/

  plugins:

    coffeelint:
      pattern: /^app\/.*\.coffee$/
      options:
        max_line_length:
          level: "ignore"
        indentation:
          value: 2
          level: "error"
    jaded:
      staticPatterns: /^app\/(.+)\.jade$/
      jade:
        pretty: yes

  server:
    path: 'server.coffee'
    port: 8080
