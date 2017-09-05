/**
 * Created by Marcel Würsch on 04.11.16.
 */

import * as _ from "lodash";
import * as fs from "fs-extra";
import * as path from "path";
import * as nconf from "nconf";
import * as os from "os";
import { isNullOrUndefined } from 'util';
import { Logger } from "../../logging/logger";
import { FileHelper } from "../fileHelper";
import { IoHelper } from "../ioHelper";
import { DivaError } from "../../models/divaError";
import { DivaFile } from '../../models/divaFile';
import IResultHandler = require("./iResultHandler");
import { Process } from "../../processingQueue/process";

/**
 * A Result Handler that reads the results from a file
 */
export class FileResultHandler implements IResultHandler {
    /**
     * The file to store the results in
     * 
     * @type {string}
     * @memberof FileResultHandler
     */
    filename: string;

    /**
     * The temporary results file to read the results from
     * 
     * @type {string}
     * @memberof FileResultHandler
     */
    tempResultFile: string;
    /**
     * Constructor
     * @param {string} resultFile The file that will contain the results
     */
    constructor(resultFile: string, tempResultFile: string) {
        this.filename = resultFile;
        this.tempResultFile = tempResultFile;
    }

    /**
     * Handling errors
     * 
     * @param {*} error the error that occurred
     * @param {Process} process the process the error occurred in
     * 
     * @memberOf FileResultHandler
     */
    handleError(error: any, process: Process): void {
        let self = this;
        fs.stat(this.filename, async function (error: any, stat: fs.Stats) {
            let data = {
                status: "done",
                resultLink: process.resultLink,
                collectionName: process.rootFolder,
                statusMessage: error,
                statusCode: 500
            };
            await IoHelper.saveFile(self.filename, data, "utf8");
        });
    }

    /**
     * Handle results, performs the following steps:
     *  - read the results from the temp result file
     *  - saves all files incoming as base64 data on the file system
     *  - creates appropriate links into the results to expose them
     * 
     * @param {*} error any possible errors
     * @param {*} stdout the standard output (not used)
     * @param {*} stderr the standard error output (not used)
     * @param {Process} process the process of the result
     * 
     * @memberOf FileResultHandler
     */
    async handleResult(error: any, stdout: any, stderr: any, process: Process): Promise<any> {
        let self = this;
        return new Promise<any>(async (resolve, reject) => {
            //check if temp result file exists
            try {
                //check if the files exists
                var resStats: fs.Stats = await fs.stat(this.tempResultFile);
                var data = await fs.readJson(self.tempResultFile, { encoding: "utf-8" });
                if (isNullOrUndefined(data.output)) {
                    data.output = [];
                }
                //filter out all files in the result
                let files = _.filter(data.output, function (entry: any) {
                    return _.has(entry, "file");
                });
                let visualization: boolean = false;
                //handle different file types to store them on DIVAServices and make them available with URLs
                for (let file of files) {
                    //handle matlab output
                    if (process.executableType === "matlab") {
                        file.file['mime-type'] = file.file['mimetype'];
                        file.file.options.visualization = Boolean(file.file.options.visualization);
                        delete file.file['mimetype'];
                    }
                    if (file.file["mime-type"].startsWith("image")) {
                        //handle images
                        FileHelper.saveJson(file.file.content, process, file.file.name);
                        file.file["url"] = IoHelper.getStaticResultFileUrl(process.outputFolder, file.file.name);
                        delete file.file.content;
                    } else if (file.file["mime-type"].startsWith("text")) {
                        //handle text files
                        file.file.content = file.file.content.replace(/(['"])/g, "");
                        file.file.content = file.file.content.replace(/\n/g, os.EOL);
                        await IoHelper.saveFile(process.outputFolder + file.file.name, file.file.content, "utf8");
                        file.file["url"] = IoHelper.getStaticResultFileUrl(process.outputFolder, file.file.name);
                        delete file.file.content;
                    } else {
                        //handle generic base64 encoded files
                        await IoHelper.saveFile(process.outputFolder + path.sep + file.file.name, file.file.content, "base64");
                        file.file["url"] = IoHelper.getStaticResultFileUrl(process.outputFolder, file.file.name);
                        delete file.file.content;
                    }
                    if (file.file.options.visualization) {
                        visualization = true;
                    }
                }
                //add log files
                let stdLogFile = {
                    file: {
                        "mime-type": "text/plain",
                        url: IoHelper.getStaticLogUrlFull(process.stdLogFile),
                        name: "standardOutputLog.log",
                        options: {
                            visualization: false,
                            type: "logfile"
                        }
                    }
                };
                let errorLogFile = {
                    file: {
                        "mime-type": "text/plain",
                        url: IoHelper.getStaticLogUrlFull(process.errLogFile),
                        name: "errorOutputLog.log",
                        options: {
                            visualization: false,
                            type: "logfile"
                        }
                    }
                };

                data.output.push(stdLogFile);
                data.output.push(errorLogFile);
                //set final data fields
                data["status"] = "done";
                data["resultLink"] = process.resultLink;
                data["collectionName"] = process.rootFolder;
                await IoHelper.saveFile(self.tempResultFile, data, "utf8");
                await IoHelper.moveFile(self.tempResultFile, self.filename);
                resolve({ data: data, procId: process.id });
            } catch (error) {
                Logger.log("error", error, "FileResultHandler");
                return reject(new DivaError("Error parsing the result", 500, "ResultError"));
            }
        });
    }

    /**
     * Handle results coming from a cwltool execution
     * 
     * 
     * @param {Process} process the process to handle 
     * @returns {Promise<any>} 
     * @memberof FileResultHandler
     */
    async handleCwlResult(process: Process): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                var procResult = await await fs.readJson(this.tempResultFile, { encoding: "utf-8" });
                var cwlResult = await fs.readJson(process.stdLogFile, { encoding: "utf-8" });

                if (isNullOrUndefined(procResult.output)) {
                    procResult.output = [];
                }

                let files = _.filter(procResult.output, function (entry: any) {
                    return _.has(entry, "file");
                });

                for (let file of files) {
                    //handle matlab output
                    if (process.executableType === "matlab") {
                        file.file['mime-type'] = file.file['mimetype'];
                        file.file.options.visualization = Boolean(file.file.options.visualization);
                        delete file.file['mimetype'];
                    }

                    //find the corresponding entry in the cwlResult to find the correct filename
                    var cwlFile = cwlResult[file.file.name.split('.')[0]];
                    await fs.move(process.outputFolder + path.sep + cwlFile.basename, process.outputFolder + path.sep + file.file.name);
                    //rename the file according to file.file.name
                    file.file["url"] = IoHelper.getStaticResultFileUrl(process.outputFolder, file.file.name);
                    delete file.file.content;

                }

                //add log files
                let stdLogFile = {
                    file: {
                        "mime-type": "text/plain",
                        url: IoHelper.getStaticLogUrlFull(process.errLogFile),
                        name: "standardOutputLog.log",
                        options: {
                            visualization: false,
                            type: "logfile"
                        }
                    }
                };
                let errorLogFile = {
                    file: {
                        "mime-type": "text/plain",
                        url: IoHelper.getStaticLogUrlFull(process.cwlLogFile),
                        name: "errorOutputLog.log",
                        options: {
                            visualization: false,
                            type: "logfile"
                        }
                    }
                };

                procResult.output.push(stdLogFile);
                procResult.output.push(errorLogFile);
                //set final data fields
                procResult["status"] = "done";
                procResult["resultLink"] = process.resultLink;
                procResult["collectionName"] = process.rootFolder;
                
                //TODO Fix this once it is known how to properly fetch logs from cwltool
                await IoHelper.saveFile(this.tempResultFile, procResult, "utf8");
                await IoHelper.moveFile(this.tempResultFile, this.filename);
                resolve({ data: procResult, procId: process.id });
            } catch (error) {
                Logger.log("error", error, "FileResultHandler::handleCwlResult");
                reject(new DivaError("Error handling the cwl result", 500, "ResultError"));
            }



            resolve();
        });
    }
}