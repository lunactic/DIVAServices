/**
 * Created by lunactic on 04.11.16.
 */

import * as fs from "fs";
import {Logger} from "../../logging/logger";
import IResultHandler = require("./iResultHandler");
import {Process}  from "../../processingQueue/process";
import {IoHelper} from "../ioHelper";

/**
 * A Result handler that is used if the results should not be stored on DIVAServices
 * 
 * @export
 * @class NoResultHandler
 * @implements {IResultHandler}
 */
export class NoResultHandler implements IResultHandler {
    filename: string;

    /**
     * Creates an instance of NoResultHandler.
     * 
     * @param {string} filename of the result file
     * 
     * @memberOf NoResultHandler
     */
    constructor(filename: string) {
        this.filename = filename;
    }

    /**
     * Error handling Function
     * 
     * @param {*} error the error object
     * @param {Process} process the process the error occured in
     * 
     * @memberOf NoResultHandler
     */
    handleError(error: any, process: Process): void {
        Logger.log("error", error, "NoResultHandler");

    }

    /**
     * 
     * handles the result.
     * 
     * If no error the result file is deleted, as it is not needed.
     * 
     * @param {*} error any possible errors
     * @param {*} stdout the standard output (not used)
     * @param {*} stderr the standard error
     * @param {Process} process the process for this results
     * @param {Function} callback the callback function
     * 
     * @memberOf NoResultHandler
     */
    handleResult(error: any, stdout: any, stderr: any, process: Process, callback: Function) {
        if (stderr.length > 0) {
            let err = {
                statusCode: 500,
                statusMessage: stderr
            };
            callback(err, null, process.id);
        } else {
            //delete the result file as it is not needed
            IoHelper.deleteFile(this.filename);
            callback(null, null, null);
        }
    }

}