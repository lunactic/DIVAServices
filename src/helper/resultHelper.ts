/**
 * Created by lunactic on 04.11.16.
 */

"use strict";

import * as _ from "lodash";
import * as path from "path";
import { FileHelper } from "./fileHelper";
import { IoHelper } from "./ioHelper";
import { ParameterHelper } from "./parameterHelper";
import { Process } from "../processingQueue/process";
import IProcess = require("../processingQueue/iProcess");
import { File } from "../models/file";
import { Logger } from "../logging/logger";

/**
 * Helper class for all result related things
 * 
 * @export
 * @class ResultHelper
 */
export class ResultHelper {

    /**
     * check if results for a process are available
     * 
     * @static
     * @param {Process} process the process to check
     * @returns {boolean} indication whether results are available or not
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
     * 
     * @memberOf ResultHelper
     */
    static async saveResult(info: IProcess): Promise<any> {
        return await IoHelper.saveFile(info.resultFile, info.result, "utf8");
    }

    /**
     * delete the results for a process
     * 
     * @static
     * @param {Process} process the process to delete results for
     * 
     * @memberOf ResultHelper
     */
    static async removeResult(process: Process) {
        try {
            await ParameterHelper.removeParamInfo(process);
        } catch (error) {
            Logger.log("error", error, "ResultHelper");
        }
        IoHelper.deleteFolder(process.outputFolder);
    }

    /**
     * load all available results computed on a specific file
     * 
     * @static
     * @param {string} folder the folder to load results from
     * @param {DivaImage} inputFile the file to load results for
     * @returns {*}
     * 
     * @memberOf ResultHelper
     */
    static loadAvailableResults(folder: string, inputFile: File): any {
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
                let processResult = IoHelper.openFile(methodResult.folder + path.sep + inputFile.filename + "json");
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
        let files: File[] = FileHelper.loadFilesMd5(md5);
        let response = [];

        for (let file of files) {
            let availableResults = this.loadAvailableResults(file.folder, file);
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