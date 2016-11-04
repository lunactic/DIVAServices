import Image = require("../models/image");
import Process = require("./process");
import IProcess = require("./iProcess");
/**
 * Class represanting a collection
 */
declare class Collection implements IProcess {
    method: string;
    name: string;
    outputLink: string;
    outputFolder: string;
    inputParameters: any;
    inputHighlighters: any;
    neededParameters: any;
    parameters: any;
    image: Image;
    processes: Process[];
    result: any;
    resultFile: string;
    rootFolder: string;
    hasFiles: boolean;
    hasImages: boolean;
    constructor();
    buildGetUrl(): string;
}
export = Collection;
