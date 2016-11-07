/**
 * Created by lunactic on 02.11.16.
 */
"use strict";
import Image = require("../models/image");
import {Process}  from "./process";
import {IoHelper} from "../helper/ioHelper";
import IProcess = require("./iProcess");

/**
 * Class represanting a collection
 */
export class Collection implements IProcess {
    public method: string;
    public name: string;
    public outputLink: string;
    public outputFolder: string;
    public inputParameters: any;
    public inputHighlighters: any;
    public neededParameters: any;
    public parameters: any;
    public image: Image;
    public processes: Process[];
    public result: any;
    public resultFile: string;
    public rootFolder: string;
    public hasFiles: boolean;
    public hasImages: boolean;

    constructor() {
        this.method = "";
        this.name = "";
        this.outputFolder = "";
        this.outputLink = "";
        this.inputParameters = {};
        this.inputHighlighters = [];
        this.neededParameters = {};
        this.parameters = {};
        this.image = new Image();
        this.processes = [];
        this.result = {};
        this.resultFile = "";
        this.rootFolder = "";
        this.hasFiles = false;
        this.hasImages = false;
    }

    buildGetUrl(): string {
        if (this.hasImages) {
            return IoHelper.getStaticImageUrlFull(this.resultFile);
        } else {
            return IoHelper.getStaticDataUrlFull(this.resultFile);
        }
    }
}