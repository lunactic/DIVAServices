/**
 * Created by lunactic on 02.11.16.
 */
"use strict";
import { Process } from "./process";
import { IoHelper } from "../helper/ioHelper";
import IProcess = require("./iProcess");
import { DivaImage } from "../models/divaImage";

/**
 * Class representing a collection
 */
export class Collection implements IProcess {

    /**
     * the method assigned to this collection
     * 
     * @type {string}
     * @memberOf Collection
     */
    public method: string;

    /**
     * the name of the collection 
     * 
     * @type {string}
     * @memberOf Collection
     */
    public name: string;

    /**
     * the static link to access this collection
     * 
     * @type {string}
     * @memberOf Collection
     */
    public outputLink: string;

    /**
     * the folder where this collection stores result
     * 
     * @type {string}
     * @memberOf Collection
     */
    public outputFolder: string;

    /**
     * all input parameters
     * 
     * @type {*}
     * @memberOf Collection
     */
    public inputParameters: any;

    /**
     * all input highlighter information
     * 
     * @type {*}
     * @memberOf Collection
     */
    public inputHighlighters: any;

    /**
     * the needed parameters for the method
     * 
     * @type {*}
     * @memberOf Collection
     */
    public neededParameters: any;

    /**
     * the matched parameters
     * 
     * @type {*}
     * @memberOf Collection
     */
    public parameters: any;

    /**
     * UNUSED
     * 
     * @type {DivaImage}
     * @memberOf Collection
     */
    public image: DivaImage;

    /**
     * the processes created in this collection
     * 
     * @type {Process[]}
     * @memberOf Collection
     */
    public processes: Process[];

    /**
     * the results
     * 
     * @type {*}
     * @memberOf Collection
     */
    public result: any;

    /**
     * the collection result file
     * 
     * @type {string}
     * @memberOf Collection
     */
    public resultFile: string;

    /**
     * the root folder of the collection
     * 
     * @type {string}
     * @memberOf Collection
     */
    public rootFolder: string;

    /**
     * collection needs input files
     * 
     * @type {boolean}
     * @memberOf Collection
     */
    public hasFiles: boolean;

    /**
     * collection needs input images
     * 
     * @type {boolean}
     * @memberOf Collection
     */
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

    /**
     * build the static url to access the result file
     * 
     * @returns {string}
     * 
     * @memberOf Collection
     */
    buildGetUrl(): string {
        if (this.hasImages) {
            return IoHelper.getStaticImageUrlFull(this.resultFile);
        } else {
            return IoHelper.getStaticDataUrlFull(this.resultFile);
        }
    }
}