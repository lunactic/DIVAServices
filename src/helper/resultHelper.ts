/**
 * Created by lunactic on 04.11.16.
 */

"use strict";

import * as _ from "lodash";
import * as path from "path";
import {ImageHelper} from "./imageHelper";
import {IoHelper} from "./ioHelper";
import {ParameterHelper} from "./parameterHelper";
import {Collection} from "../processingQueue/collection";
import {Process}  from "../processingQueue/process";
import IProcess = require("../processingQueue/iProcess");
import {DivaImage} from "../models/divaImage";

/**
 * Helper class for all result related things
 * 
 * @export
 * @class ResultHelper
 */
export class ResultHelper {

    /**
     * check if results for a specific collection are available
     * 
     * @static
     * @param {Collection} collection the collection to check
     * @returns {boolean} indication wheter results are available or not
     * 
     * @memberOf ResultHelper
     */
    static checkCollectionResultsAvailable(collection: Collection): boolean {
        collection.rootFolder = collection.name;
        _.forIn(collection.inputHighlighters, function (value: any, key: string) {
            collection.inputHighlighters[key] = String(value);
        });

        ParameterHelper.loadParamInfo(collection);
        collection.resultFile = collection.outputFolder + path.sep + "result.json";
        return IoHelper.fileExists(collection.resultFile);
    }

    /**
     * check if results for a process are available
     * 
     * @static
     * @param {Process} process the process to check
     * @returns {boolean} indication wheter results are available or not
     * 
     * @memberOf ResultHelper
     */
    static checkProcessResultAvailable(process: Process): boolean {
        ParameterHelper.loadParamInfo(process);
        return process.resultFile != null && IoHelper.fileExists(process.resultFile);
    }

    /**
     * load the results for a process / collection
     * 
     * @static
     * @param {IProcess} process the process to load results for
     * @returns {*}
     * 
     * @memberOf ResultHelper
     */
    static loadResult(process: IProcess): any {
        return IoHelper.openFile(process.resultFile);
    }

    /**
     * save the results for a process / collection
     * 
     * @static
     * @param {IProcess} info the process to save results for
     * @param {Function} [callback] the callback function
     * 
     * @memberOf ResultHelper
     */
    static saveResult(info: IProcess, callback?: Function): void {
        IoHelper.saveFile(info.resultFile, info.result, "utf8", callback);
    }

    /**
     * delete the results for a process
     * 
     * @static
     * @param {Process} process the process to delete results for
     * 
     * @memberOf ResultHelper
     */
    static removeResult(process: Process): void {
        ParameterHelper.removeParamInfo(process);
        IoHelper.deleteFolder(process.outputFolder);
    }

    /**
     * load all available results computed on a specific image
     * 
     * @static
     * @param {string} folder the folder to load results from
     * @param {DivaImage} image the image to load results for
     * @returns {*}
     * 
     * @memberOf ResultHelper
     */
    static loadAvailableResults(folder: string, image: DivaImage): any {
        let files: string[] = IoHelper.readFolder(folder);
        let results = [];
        if (files != null) {
            files = _.filter(files, function (file: string) {
                return file.endsWith("json") && !(file === 'status.json');
            });
        }

        for (let file of files) {
            let methodResults = IoHelper.openFile(folder + path.sep + file);
            for (let methodResult of methodResults) {
                let processResult = IoHelper.openFile(methodResult.folder + path.sep + image.name + "json");
                processResult["method"] = file.split(".")[0];
                processResult["parameters"] = methodResult.parameters;
                results.push(processResult);
            }
        }
        return results;
    }

    /**
     * load results based on an md5 hash of an image
     * 
     * @static
     * @param {string} md5 the md5 hash
     * @returns {*} the available results
     * 
     * @memberOf ResultHelper
     */
    static loadResultsForMd5(md5: string): any {
        let images: DivaImage[] = ImageHelper.loadImagesMd5(md5);
        let response = [];

        for (let image of images) {
            let availableResults = this.loadAvailableResults(image.rootFolder, image);
            for (let result of availableResults) {
                let message = {
                    resultLink: result.resultLink,
                    method: result.method,
                    collectionName: result.collectionName,
                    parameters: result.parameters
                };
                response.push(message);
            }
        }
        response["status"] = "done";
        return response;
    }

}