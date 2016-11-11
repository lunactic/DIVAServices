import {DivaImage} from "../models/divaImage";
import IProcess = require("./iProcess");
/**
 *Class representing a process to be executed
 */
declare class Process implements IProcess {
    id: string;
    algorithmIdentifier: string;
    executableType: string;
    req: any;
    method: string;
    image: Image;
    rootFolder: string;
    outputFolder: string;
    methodFolder: string;
    neededParameters: any;
    inputParameters: any;
    inputHighlighters: any;
    inputFolder: string;
    parameters: any;
    programType: string;
    executablePath: string;
    resultHandler: any;
    resultType: string;
    resultFile: string;
    tmpResultFile: string;
    requireOutputImage: any;
    inputImageUrl: string;
    outputImageUrl: string;
    result: any;
    resultLink: string;
    data: string;
    remoteResultUrl: string;
    remotePaths: any;
    type: string;
    hasFiles: boolean;
    hasImages: boolean;
    constructor();
    buildGetUrl(): string;
}
export = Process;
