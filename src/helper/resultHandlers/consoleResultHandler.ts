/**
 * Created by lunactic on 04.11.16.
 */

import * as fs from "fs";
import * as nconf from "nconf";
import {Logger}  from "../../logging/logger";
import {ImageHelper} from "../imageHelper";
import IResultHandler = require("./iResultHandler");
import {Process} from "../../processingQueue/process";
import {IoHelper} from "../ioHelper";

/**
 * A Result Handler implementation for results coming from the console
 */
export class ConsoleResultHandler implements IResultHandler {
    filename: string;

    constructor(filename: string) {
        this.filename = filename;
    }

    handleError(error: any, process: Process): void {
        Logger.log("error", error, "ConsoleResultHandler");
    }

    handleResult(error: any, stdout: any, stderr: any, process: Process, callback: Function) {
        let self = this;
        if (stderr.length > 0) {
            let err = {
                statusCode: 500,
                statusMessage: stderr
            };
            callback(err, null, process.id);
        } else {
            fs.stat(self.filename, function (err: any, stat: fs.Stats) {
                if (err == null) {
                    fs.readFile(self.filename, "utf8", function (err: any, data: any) {
                        if (err != null) {
                            Logger.log("error", err, "ConsoleResultHandler");
                            callback(err, null, null);
                        } else {
                            try {
                                data = JSON.parse(data);
                                data["status"] = "done";
                                if (data["image"] != null) {
                                    ImageHelper.saveJson(data["image"], process, "");
                                    process.outputImageUrl = process.image.getImageUrl(process.inputFolder);
                                    data["outputImage"] = process.outputImageUrl;
                                    delete data["image"];
                                }
                                data["inputImage"] = process.inputImageUrl;
                                data["resultLink"] = process.resultLink;
                                data["collectionName"] = process.rootFolder;
                                data["resultZipLink"] = "http://" + nconf.get("server:rootUrl") + "/collection/" + process.rootFolder + "/" + process.methodFolder;
                                IoHelper.saveFile(self.filename, data, "utf8", null);
                            } catch (error) {
                                Logger.log("error", error, "ConsoleResultHandler");
                            }
                            callback(null, data, process.id);
                        }
                    });
                } else {
                    Logger.log("error", err, "ConsoleResultHandler");
                    callback(err, null, null);
                }
            });
        }

    }


}