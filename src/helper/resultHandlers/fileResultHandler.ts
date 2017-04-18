/**
 * Created by Marcel Würsch on 04.11.16.
 */

import * as _ from "lodash";
import * as fs from "fs";
import * as path from "path";
import * as nconf from "nconf";
import { isNullOrUndefined } from 'util';
import { Logger } from "../../logging/logger";
import { FileHelper } from "../fileHelper";
import { IoHelper } from "../ioHelper";
import { DivaError } from "../../models/divaError";
import IResultHandler = require("./iResultHandler");
import { Process } from "../../processingQueue/process";

/**
 * A Result Handler that reads the results from a file
 */
export class FileResultHandler implements IResultHandler {
    filename: string;

    /**
     * Constructor
     * @param {string} filename The file that will contain the results
     */
    constructor(filename: string) {
        this.filename = filename;
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
     * The result handler
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
            fs.stat(this.filename, function (error: any, stat: fs.Stats) {
                if (error == null) {
                    fs.readFile(self.filename, "utf8", async function (err: any, data: any) {
                        if (err != null) {
                            return reject(new DivaError("Error processing the result", 500, "ResultError"));
                        } else {
                            try {
                                data = JSON.parse(data);
                                if (isNullOrUndefined(data.output)) {
                                    data.output = [];
                                }
                                let files = _.filter(data.output, function (entry: any) {
                                    return _.has(entry, "file");
                                });
                                for (let file of files) {
                                    if (process.executableType === "matlab") {
                                        file.file['mime-type'] = file.file['mimetype'];
                                        file.file.options.visualization = Boolean(file.file.options.visualization);
                                        delete file.file['mimetype'];
                                    }
                                    if (file.file["mime-type"].startsWith("image")) {
                                        FileHelper.saveJson(file.file.content, process, file.file.name);
                                        file.file["url"] = IoHelper.getStaticResultFileUrl(process.outputFolder, file.file.name);
                                        delete file.file.content;
                                    } else if (file.file["mime-type"] === "text/plain") {
                                        await IoHelper.saveFile(process.outputFolder + path.sep + file.file.name, file.file.content, "utf8");
                                        file.file["url"] = IoHelper.getStaticResultFileUrl(process.outputFolder, file.file.name);
                                        delete file.file.content;
                                    } else {
                                        await IoHelper.saveFile(process.outputFolder + path.sep + file.file.name, file.file.content, "base64");
                                        file.file["url"] = IoHelper.getStaticResultFileUrl(process.outputFolder, file.file.name);
                                        delete file.file.content;
                                    }
                                }
                                //check if a visualization is available
                                //set final data fields
                                data["status"] = "done";
                                //data["inputImage"] = process.inputImageUrl;
                                data["resultLink"] = process.resultLink;
                                data["collectionName"] = process.rootFolder;
                                //data["resultZipLink"] = "http://" + nconf.get("server:rootUrl") + "/collection/" + process.rootFolder + "/" + process.methodFolder;
                                await IoHelper.saveFile(self.filename, data, "utf8");
                                resolve({ data: data, procId: process.id });
                            } catch (error) {
                                Logger.log("error", error, "FileResultHandler");
                                return reject(new DivaError("Error parsing the result", 500, "ResultError"));
                            }
                        }
                    });
                } else {
                    Logger.log("error", error, "FileResultHandler");
                    return reject(new DivaError("Error processing the result", 500, "ResultError"));
                }
            });
        });

    }
}