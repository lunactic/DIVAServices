/**
 * Created by Marcel Würsch on 04.11.16.
 */

import * as fs from "fs";
import * as nconf from "nconf";
import { Logger } from "../../logging/logger";
import { FileHelper } from "../fileHelper";
import IResultHandler = require("./iResultHandler");
import { Process } from "../../processingQueue/process";
import { IoHelper } from "../ioHelper";
import { DivaError } from '../../models/divaError';

/**
 * 
 * DISCLAIMER: This class in its current form will probably not work well and will need some updates
 * 
 * A Result Handler implementation for results coming from the console
 */
export class ConsoleResultHandler implements IResultHandler {
    filename: string;

    /**
     * Creates an instance of ConsoleResultHandler.
     * 
     * @param {string} filename the result file
     * 
     * @memberOf ConsoleResultHandler
     */
    constructor(filename: string) {
        this.filename = filename;
    }

    /**
     * 
     * handles possible errors
     * 
     * @param {*} error the error that occurred
     * @param {Process} process the process the error occurred in
     * 
     * @memberOf ConsoleResultHandler
     */
    handleError(error: any, process: Process): void {
        Logger.log("error", error, "ConsoleResultHandler");
    }

    /**
     * handle the results
     * 
     * @param {*} error any possible errors
     * @param {*} stdout the standard output to read the results from
     * @param {*} stderr the standard error output to read possible errors from
     * @param {Process} process the process the result is from
     * 
     * @memberOf ConsoleResultHandler
     */
    async handleResult(error: any, stdout: any, stderr: any, process: Process): Promise<any> {
        let self = this;
        return new Promise<any>(async (resolve, reject) => {
            if (stderr.length > 0) {
                return reject(new DivaError(stderr, 500, "ResultError"));
            } else {
                fs.stat(self.filename, function (err: any, stat: fs.Stats) {
                    if (err == null) {
                        fs.readFile(self.filename, "utf8", async function (err: any, data: any) {
                            if (err != null) {
                                Logger.log("error", err, "ConsoleResultHandler");
                                return reject(new DivaError(err.message, 500, "ResultError"));
                            } else {
                                try {
                                    data = JSON.parse(data);
                                    data["status"] = "done";
                                    if (data["image"] != null) {
                                        FileHelper.saveJson(data["image"], process, "");
                                        //process.outputImageUrl = process.image.getImageUrl(process.inputFolder);
                                        //data["outputImage"] = process.outputImageUrl;
                                        delete data["image"];
                                    }
                                    //data["inputImage"] = process.inputImageUrl;
                                    data["resultLink"] = process.resultLink;
                                    data["collectionName"] = process.rootFolder;
                                    //data["resultZipLink"] = "http://" + nconf.get("server:rootUrl") + "/collection/" + process.rootFolder + "/" + process.methodFolder;
                                    await IoHelper.saveFile(self.filename, data, "utf8");
                                } catch (error) {
                                    Logger.log("error", error, "ConsoleResultHandler");
                                }
                                resolve({ data: data, procId: process.id });
                            }
                        });
                    } else {
                        Logger.log("error", err, "ConsoleResultHandler");
                        return reject(new DivaError(err.message, 500, "ResultError"));
                    }
                });
            }
        });

    }


}