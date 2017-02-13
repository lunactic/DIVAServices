import { DivaData } from '../models/divaData';
/**
 * Created by lunactic on 02.11.16.
 */

"use strict";
import { DivaImage } from "../models/divaImage";
import {DivaData} from "../models/divaData";
import { IoHelper } from "../helper/ioHelper";
import IProcess = require("./iProcess");
import IResultHandler = require("../helper/resultHandlers/iResultHandler");
import * as express from "express";
/**
 *Class representing a process to be executed
 */
export class Process implements IProcess {
    /**
     * the process identifier
     * 
     * @type {string}
     * @memberOf Process
     */
    public id: string;

    /**
     * the running process number
     * 
     * @type {number}
     * @memberOf Process
     */
    public number: number;

    /**
     * the identifier of the applied algorithm
     * 
     * @type {string}
     * @memberOf Process
     */
    public algorithmIdentifier: string;

    /**
     * the executable type
     * 
     * @type {string}
     * @memberOf Process
     */
    public executableType: string;

    /**
     * the incoming POST request
     * 
     * @type {express.Request}
     * @memberOf Process
     */
    public req: express.Request = null;

    /**
     *  the name of the method
     * 
     * @type {string}
     * @memberOf Process
     */
    public method: string;

    /**
     * the input image
     * 
     * @type {DivaImage}
     * @memberOf Process
     */
    public image: DivaImage;

    /**
     * the input data
     * 
     * @type {DivaData}
     * @memberOf Process
     */
    public data: DivaData;

    /**
     * the root folder
     * 
     * @type {string}
     * @memberOf Process
     */
    public rootFolder: string;

    /**
     * the output folder to use
     * 
     * @type {string}
     * @memberOf Process
     */
    public outputFolder: string;

    /**
     * the folder of the method
     * 
     * @type {string}
     * @memberOf Process
     */
    public methodFolder: string;

    /**
     * the needed parameters for the method
     * 
     * @type {*}
     * @memberOf Process
     */
    public neededParameters: any;

    /**
     * the provided input parameters
     * 
     * @type {*}
     * @memberOf Process
     */
    public inputParameters: any;

    /**
     * the provided highlighter information
     * 
     * @type {*}
     * @memberOf Process
     */
    public inputHighlighters: any;

    /**
     * the input folder
     * 
     * @type {string}
     * @memberOf Process
     */
    public inputFolder: string;

    /**
     * the matched parameters
     * 
     * @type {*}
     * @memberOf Process
     */
    public parameters: any;

    /**
     * the type of the program
     * 
     * @type {string}
     * @memberOf Process
     */
    public programType: string;

    /**
     * the path to the executable
     * 
     * @type {string}
     * @memberOf Process
     */
    public executablePath: string;

    /**
     * the result handler to use after computation is done
     * 
     * @type {IResultHandler}
     * @memberOf Process
     */
    public resultHandler: IResultHandler;

    /**
     * the result type
     * 
     * @type {string}
     * @memberOf Process
     */
    public resultType: string;

    /**
     * the path to the result file
     * 
     * @type {string}
     * @memberOf Process
     */
    public resultFile: string;

    /**
     * the path to the temporary result file
     * 
     * @type {string}
     * @memberOf Process
     */
    public tmpResultFile: string;

    /**
     * the static url to the input image
     * 
     * @type {string}
     * @memberOf Process
     */
    public inputImageUrl: string;

    /**
     * the static url to the output image
     * 
     * @type {string}
     * @memberOf Process
     */
    public outputImageUrl: string;

    /**
     * the static url to the input data
     */
    public inputDataUrl: string;

    /**
     * the static url to the output data
     */
    public outputDataUrl: string;

    /**
     * the computed results
     * 
     * @type {*}
     * @memberOf Process
     */
    public result: any;

    /**
     * the static url to the results
     * 
     * @type {string}
     * @memberOf Process
     */
    public resultLink: string;

    /**
     * the url to POST results to
     * 
     * @type {string}
     * @memberOf Process
     */
    public remoteResultUrl: string;

    /**
     * the url to POST errors to
     * 
     * @type {string}
     * @memberOf Process
     */
    public remoteErrorUrl: string;

    /**
     * the remote paths to use for certain parameters
     * 
     * @type {*}
     * @memberOf Process
     */
    public remotePaths: any;

    /**
     * the type of process
     * 
     * @type {string}
     * @memberOf Process
     */
    public type: string;

    /**
     * the standard output
     * 
     * @type {*}
     * @memberOf Process
     */
    public stdout: any;

    /**
     * the standard input
     * 
     * @type {*}
     * @memberOf Process
     */
    public stdin: any;

    /**
     * process requires input files
     * 
     * @type {boolean}
     * @memberOf Process
     */
    public hasFiles: boolean;

    /**
     * process requires input images
     * 
     * @type {boolean}
     * @memberOf Process
     */
    public hasImages: boolean;

    /**
     * Creates an instance of Process.
     * 
     * 
     * @memberOf Process
     */
    constructor() {
        this.hasFiles = false;
        this.hasImages = false;
    }

    /**
     * build the static url to access the result file
     * 
     * @returns {string}
     * 
     * @memberOf Process
     */
    buildGetUrl(): string {
        if (this.hasImages) {
            return IoHelper.getStaticImageUrlFull(this.resultFile);
        } else {
            return IoHelper.getStaticDataUrlFull(this.resultFile);
        }
    }
}