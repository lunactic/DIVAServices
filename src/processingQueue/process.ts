/**
 * Created by lunactic on 02.11.16.
 */

"use strict";
import Image = require("../models/image");
import {IoHelper} from "../helper/ioHelper";
import IProcess = require("./iProcess");
/**
 *Class representing a process to be executed
 */
class Process implements IProcess {
    public id: string;
    public algorithmIdentifier: string;
    public executableType: string;
    public req = null;
    public method: string;
    public image: Image;
    public rootFolder: string;
    public outputFolder: string;
    public methodFolder: string;
    public neededParameters;
    public inputParameters: any;
    public inputHighlighters: any;
    public inputFolder: string;
    public parameters: any;
    public programType: string;
    public executablePath: string;
    public resultHandler;
    public resultType: string;
    public resultFile: string;
    public tmpResultFile: string;
    public requireOutputImage;
    public inputImageUrl: string;
    public outputImageUrl: string;
    public result;
    public resultLink: string;
    public data: string;
    public remoteResultUrl: string;
    public remoteErrorUrl: string;
    public remotePaths;
    public type: string;
    public stdout: any;
    public stdin: any;

    public hasFiles: boolean;
    public hasImages: boolean;

    constructor() {
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
export = Process;