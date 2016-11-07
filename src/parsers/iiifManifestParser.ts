"use strict";
/**
 * Created by lunactic on 07.11.16.
 */
let manifesto = require("manifesto.js");

export class IiifManifestParser {

    manifestUrl: string;
    manifest: any;

    constructor(manifestUrl: string) {
        this.manifestUrl = manifestUrl;
    }

    public initialize(): Promise<any> {
        let self = this;
        return manifesto.loadManifest(this.manifestUrl).then(function (manifest: any) {
            return self.manifest = manifesto.create(manifest);
        });
    }

    public getAllImages(seqIndex: number): any {
        let images: any = [];
        let sequence = this.manifest.getSequenceByIndex(seqIndex);
        let canvases = sequence.getCanvases();
        for (let canvas of canvases) {
            images.push(canvas.getImages()[0].getResource().id);
        }
        return images;
    }

    public getMetadata(): any {
        return this.manifest.getMetadata();
    }

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