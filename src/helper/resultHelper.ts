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
import Image = require("../models/image");

export class ResultHelper {

    static checkCollectionResultsAvailable(collection: Collection): boolean {
        collection.rootFolder = collection.name;
        _.forIn(collection.inputHighlighters, function (value: any, key: string) {
            collection.inputHighlighters[key] = String(value);
        });

        ParameterHelper.loadParamInfo(collection);
        collection.resultFile = collection.outputFolder + path.sep + "result.json";
        return IoHelper.fileExists(collection.resultFile);
    }

    static checkProcessResultAvailable(process: Process): boolean {
        ParameterHelper.loadParamInfo(process);
        return process.resultFile !== null && IoHelper.fileExists(process.resultFile);
    }

    static loadResult(info: IProcess): any {
        return IoHelper.loadFile(info.resultFile);
    }

    static saveResult(info: IProcess, callback: Function): void {
        IoHelper.saveFile(info.resultFile, info.result, "utf8", callback);
    }

    static removeResult(process: Process): void {
        ParameterHelper.removeParamInfo(process);
        IoHelper.deleteFolder(process.outputFolder);
    }

    static loadAvailableResults(folder: string, image: Image): any {
        let files: string[] = IoHelper.readFolder(folder);
        let results = [];
        if (files !== null) {
            files = _.filter(files, function (file: string) {
                return file.endsWith("json");
            });
        }

        for (let file of files) {
            let methodResults = IoHelper.loadFile(folder + path.sep + file);
            for (let methodResult of methodResults) {
                let processResult = IoHelper.loadFile(methodResult.folder + path.sep + image.name + ".json");
                processResult["method"] = file.split(".")[0];
                processResult["parameters"] = methodResult.parameters;
                results.push(processResult);
            }
        }
        return results;
    }

    static loadResultsForMd5(md5: string): any {
        let images: Image[] = ImageHelper.loadImagesMd5(md5);
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