"use strict";
/**
 * Created by Marcel Würsch on 07.11.16.
 */
let manifesto = require("manifesto.js");

/**
 * parser for iiif files
 * 
 * this class is in early development
 * 
 * @export
 * @class IiifManifestParser
 */
export class IiifManifestParser {

    manifestUrl: string;
    manifest: any;

    /**
     * Creates an instance of IiifManifestParser.
     * 
     * @param {string} manifestUrl the url to the manifest file to use
     * 
     * @memberOf IiifManifestParser
     */
    constructor(manifestUrl: string) {
        this.manifestUrl = manifestUrl;
    }

    /**
     * load the manifest file
     * 
     * @returns {Promise<any>} 
     * 
     * @memberOf IiifManifestParser
     */
    public initialize(): Promise<any> {
        let self = this;
        return manifesto.loadManifest(this.manifestUrl).then(function (manifest: any) {
            return self.manifest = manifesto.create(manifest);
        });
    }

    /**
     * Get all images of a specific sequence from the manifest file
     * 
     * @param {number} seqIndex the index of the sequence
     * @returns {*} the images in the sequence
     * 
     * @memberOf IiifManifestParser
     */
    public getAllImages(seqIndex: number): any {
        let images: any = [];
        let sequence = this.manifest.getSequenceByIndex(seqIndex);
        let canvases = sequence.getCanvases();
        for (let canvas of canvases) {
            images.push(canvas.getImages()[0].getResource().id);
        }
        return images;
    }

    /**
     * get all metadata information
     * 
     * @returns {*} the metadata object
     * 
     * @memberOf IiifManifestParser
     */
    public getMetadata(): any {
        return this.manifest.getMetadata();
    }

    /**
     * get the description
     * 
     * @returns {*} the description object
     * 
     * @memberOf IiifManifestParser
     */
    public getDescription(): any {
        return this.manifest.getDescription();
    }

    public getLabel(): any {
        return this.manifest.getLabel();
    }

    public getLicense(): any {
        return this.manifest.getLicense();
    }

    public getAttribution(): any {
        return this.manifest.getAttribution();
    }

}