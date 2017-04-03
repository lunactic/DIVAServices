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
    static async removeResult(process: Process): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await ParameterHelper.removeParamInfo(process);
                IoHelper.deleteFolder(process.outputFolder);
                resolve();
            } catch (error) {
                Logger.log("error", error, "ResultHelper");
                reject(error);
            }
        });
    }
}