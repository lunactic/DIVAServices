/**
 * Created by lunactic on 02.11.16.
 */
"use strict";
import {Process}  from "./process";
import {IoHelper} from "../helper/ioHelper";
import IProcess = require("./iProcess");
import {DivaImage} from "../models/divaImage";

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
    public image: DivaImage;
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
        this.image = new DivaImage();
        this.processes = [];
        this.result = null;
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