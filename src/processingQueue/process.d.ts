import Image = require("../models/image");
/**
 *Class representing a process to be executed
 */
declare class Process {
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
    inputParameters: string;
    inputHighlighters: string;
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
}
export = Process;
