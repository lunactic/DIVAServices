/**
 * Created by lunactic on 04.11.16.
 */

import * as _ from "lodash";
import * as fs from "fs";
import * as path from "path";
import * as nconf from "nconf";
import {Logger} from "../../logging/logger";
import {ImageHelper} from "../imageHelper";
import {IoHelper} from "../ioHelper";

import IResultHandler = require("./iResultHandler");
import {Process} from "../../processingQueue/process";

export class FileResultHandler implements IResultHandler {
    filename: string;

    constructor(filename: string) {
        this.filename = filename;
    }

    handleError(error: any, process: Process): void {
        let self = this;
        fs.stat(this.filename, function (error: any, stat: fs.Stats) {
            let data = {
                status: "done",
                resultLink: process.resultLink,
                collectionName: process.rootFolder,
                statusMessage: error,
                statusCode: 500
            };
            IoHelper.saveFile(self.filename, data, "utf8", null);
        });
    }

    handleResult(error: any, stdout: any, stderr: any, process: Process, callback: Function) {
        let self = this;
        fs.stat(this.filename, function (error: any, stat: fs.Stats) {
            if (error == null) {
                fs.readFile(self.filename, "utf8", function (err: any, data: any) {
                    if (err != null) {
                        let error = {
                            statusCode: 500,
                            statusMessage: "Could not read result file"
                        };
                        callback(error, null, null);
                    } else {
                        try {
                            data = JSON.parse(data);
                            if (process.executableType === "matlab") {
                                //get the current outputContent
                                let tmpOutput = data.output;
                                //push all objects into the output array
                                data.output = [];
                                _.forIn(tmpOutput, function (value: any, key: string) {
                                    let newKey = key.replace(/\d/g, "");
                                    let newObject = {};
                                    if (value.hasOwnProperty("mimetype")) {
                                        value["mime-type"] = value.mimetype;
                                        delete value.mimetype;
                                    }
                                    newObject[newKey] = value;
                                    data.output.push(newObject);
                                });
                            }
                            let files = _.filter(data.output, function (entry: any) {
                                return _.has(entry, "file");
                            });
                            let visualization: boolean = false;
                            for (let file of files) {
                                if (file.file["mime-type"].startsWith("image")) {
                                    ImageHelper.saveJson(file.file.content, process, file.file.name);
                                    if (process.hasImages) {
                                        file.file["url"] = IoHelper.getStaticImageUrl(process.rootFolder + path.sep + process.methodFolder, file.file.name + "." + ImageHelper.getImageExtensionBase64(file.file.content));
                                    } else if (process.hasFiles) {
                                        file.file["url"] = IoHelper.getStaticDataUrl(process.rootFolder + path.sep + process.methodFolder, file.file.name + "txt");
                                    }

                                    if (file.file.options.visualization) {
                                        visualization = true;
                                        process.outputImageUrl = file.file.url;
                                    }
                                    delete file.file.content;
                                } else if (file.file["mime-type"] === "text/plain") {
                                    IoHelper.saveFile(process.outputFolder + path.sep + file.file.name + ".txt", file.file.content, "utf8", null);
                                    if (process.hasImages) {
                                        file.file["url"] = IoHelper.getStaticImageUrl(process.rootFolder + path.sep + process.methodFolder, file.file.name + ".txt");
                                    } else if (process.hasFiles) {
                                        file.file["url"] = IoHelper.getStaticDataUrl(process.rootFolder + path.sep + process.methodFolder, file.file.name + ".txt");
                                    }
                                    delete file.file.content;
                                } else {
                                    IoHelper.saveFile(process.outputFolder + path.sep + file.file.filename, file.file.content, "base64", null);
                                    if (process.hasImages) {
                                        file.file["url"] = IoHelper.getStaticImageUrl(process.rootFolder + path.sep + process.methodFolder, file.file.name);
                                    } else if (process.hasFiles) {
                                        file.file["url"] = IoHelper.getStaticDataUrl(process.rootFolder + path.sep + process.methodFolder, file.file.name);
                                    }
                                }
                            }
                            //check if a visualization is available
                            if (!visualization && process.inputImageUrl != null) {
                                let file = {
                                    file: {
                                        "mime-type": "png",
                                        url: process.inputImageUrl,
                                        name: "visualization",
                                        options: {
                                            visualization: true,
                                            type: "outputVisualization"
                                        }
                                    }
                                };
                                data.output.push(file);
                            }
                            //set final data fields
                            data["status"] = "done";
                            data["inputImage"] = process.inputImageUrl;
                            data["resultLink"] = process.resultLink;
                            data["collectionName"] = process.rootFolder;
                            data["resultZipLink"] = "http://" + nconf.get("server:rootUrl") + "/collection/" + process.rootFolder + "/" + process.methodFolder;
                            IoHelper.saveFile(self.filename, data, "utf8", null);
                        } catch (error) {
                            Logger.log("error", error, "FileResultHandler");
                            let err = {
                                statusCode: 500,
                                statusMessage: "Could not parse result"
                            };
                            callback(err, null, null);
                        }
                        callback(null, data, process.id);
                    }
                });
            } else {
                Logger.log("error", error, "FileResultHandler");
                callback(error, null, null);
            }
        });
    }
}