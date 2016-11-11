import {DivaImage} from "../models/divaImage";
import {Process} from "./process";
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
    image: DivaImage;
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
