iifManifestParser = exports = module.exports = class IiifManifestParser

  manifesto = require 'manifesto.js'
  q         = require 'q'
  constructor: (manifestUrl) ->
    @manifestUrl = manifestUrl

  initialize: () ->
    self = @
    manifesto.loadManifest(@manifestUrl).then (manifest) ->
      self.manifest = manifesto.create(manifest)


  getAllImages: (seqIndex) ->
    images = []
    sequence = @manifest.getSequenceByIndex(seqIndex)
    canvases = sequence.getCanvases()
    for canvas in canvases
      images.push(canvas.getImages()[0].getResource().id)

    return images

  getMetadata: () ->
    return @manifest.getMetadata()

  getDescription: () ->
    return @manifest.getDescription()

  getLabel: () ->
    return @manifest.getLabel()

  getLicense: () ->
    return @manifest.getLicense()

  getAttribution: () ->
    return @manifest.getAttribution()