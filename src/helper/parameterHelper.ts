/**
 * Created by lunactic on 03.11.16.
 */
"use strict";

import * as _ from "lodash";
import * as fs from "fs";
import * as nconf from "nconf";
import * as path from "path";
import * as hash from "object-hash";
import {IoHelper} from "./ioHelper";
import {Logger} from "../logging/logger";
import {Process} from "../processingQueue/process";
import IProcess = require("../processingQueue/iProcess");

export class ParameterHelper {
    static getParamValue(parameter: string, inputParameter: string): string {
        if (inputParameter.hasOwnProperty(parameter)) {
            return inputParameter[parameter];
        } else {
            return null;
        }
    }

    static getReservedParamValue(parameter: string, process: Process, req: any): string {
        switch (parameter) {
            case "matlabPath":
                return nconf.get("paths:matlabPath");
            case "matlabScriptsPath":
                return nconf.get("paths:matlabScriptsPath");
            case "inputFileExtension":
                return path.extname(process.image.path).slice(1);
            case "inputFolder":
                return process.inputFolder;
            case "inputImage":
                return process.image.path;
            case "inputImageUrl":
                return process.image.getImageUrl(process.image.md5);
            case "imageRootPath":
                return nconf.get("paths:imageRootPath");
            case "outputFolder":
                return process.outputFolder;
            case "host":
                return nconf.get("server:rootUrl");
            case "ocropyLanguageModelsPath":
                return nconf.get("paths:ocropyLanguageModelsPath");
            case "startUp":
                return process.neededParameters["startUp"];
            case "outputImage":
                return "##outputImage##";
            case "noisingXmlFile":
                return nconf.get("paths:noisingXmlPath");
            case "mcr2014b":
                return nconf.get("paths.mcr2014b");
        }
    }

    static matchParams(process: Process, req: any): any {
        let params = {};
        let outputParams = {};

        for (let neededParameter of process.neededParameters) {
            //build parameters
            let paramKey = _.keys(neededParameter)[0];
            let paramValue = neededParameter[paramKey];

            if (this.checkReservedParameters(paramKey)) {
                //check if highlighter
                if (paramKey === "highlighter") {
                    params[paramKey] = this.getHighlighterParamValues(process.inputHighlighters.type, process.inputHighlighters.segments);
                } else {
                    params[paramKey] = this.getReservedParamValue(paramKey, process, req);
                }
            } else {
                //handle json
                let value = this.getParamValue(paramKey, process.inputParameters);
                if (value != null) {
                    if (paramValue === "json") {
                        let jsonFile = process.outputFolder + path.sep + "jsonInput.json";
                        IoHelper.saveFile(jsonFile, value, "utf-8", null);
                        params[paramKey] = jsonFile;
                        outputParams[paramKey] = jsonFile;
                    } else {
                        params[paramKey] = value;
                        outputParams[paramKey] = value;
                    }
                } else if (paramValue === "url") {
                    params[paramKey] = "";
                    outputParams[paramKey] = "";
                }
            }
        }
        let result = {
            params: params,
            outputParams: outputParams
        };
        return result;
    }

    static getHighlighterParamValues(neededHighlighter: string, inputHighlighter: any): any {
        switch (neededHighlighter) {
            case "polygon":
            case "rectangle":
                let merged = [];
                merged = merged.concat.apply(merged, inputHighlighter);
                merged = merged.map(Math.round);
                return merged.join(" ");
            case "circle":
                let position = inputHighlighter.position.map(Math.round);
                let radius = Math.round(inputHighlighter.radius);
                return position[0] + " " + position[1] + " " + radius;
        }
    }

    static getMethodName(algorithm: string): string {
        return algorithm.replace(/\//g, "");
    }

    static saveParamInfo(process: Process): void {
        if (process.result !== null) {
            return;
        }
        let methodPath = "";
        if (process.hasImages) {
            methodPath = nconf.get("paths:imageRootPath") + path.sep + process.rootFolder + path.sep + process.method + ".json";
        } else {
            methodPath = nconf.get("paths:dataRootPath") + path.sep + process.rootFolder + path.sep + process.method + ".json";
        }

        let content = [];
        let data: any = {};
        if (process.inputHighlighters !== null) {
            data = {
                highlighters: _.clone(process.inputHighlighters),
                parameters: hash(process.inputParameters),
                folder: process.outputFolder
            };
        } else {
            data = {
                highlighters: {},
                parameters: hash(process.inputParameters),
                folder: process.outputFolder
            };
        }

        //turn everything into strings
        _.forIn(data.highlighters, function (value: string, key: string) {
            data.highlighters[key] = String(value);
        });

        Logger.log("info", "saveParamInfo", "ParameterHelper");
        Logger.log("info", JSON.stringify(process.inputParameters), "ParameterHelper");
        Logger.log("info", "hash: " + data.parameters, "ParameterHelper");

        try {
            fs.statSync(methodPath).isFile();
            let content = IoHelper.loadFile(methodPath);
            //only save the information if it is not already present
            if (_.filter(content, {"parameters": data.parameters, "highlighters": data.highlighters}).length > 0) {
                content.push(data);
                IoHelper.saveFile(methodPath, content, "utf8", null);
            }
        } catch (error) {
            content.push(data);
            IoHelper.saveFile(methodPath, content, "utf8", null);
        }
    }

    static loadParamInfo(process: IProcess): void {
        let paramPath = "";
        if (process.hasImages) {
            paramPath = nconf.get("paths:imageRootPath") + path.sep + process.rootFolder + path.sep + process.method + ".json";
        } else {
            paramPath = nconf.get("paths:dataRootPath") + path.sep + process.rootFolder + path.sep + process.method + ".json";
        }

        let data = {
            highlighters: process.inputHighlighters,
            parameters: hash(process.inputParameters)
        };
        try {
            fs.statSync(paramPath).isFile();
            let content = IoHelper.loadFile(paramPath);
            let info: any = {};
            if (info = _.filter(content, {
                        "parameters": data.parameters,
                        "highlighters": data.highlighters
                    }).length > 0) {
                //found some method information
                if (process.hasImages) {
                    if (process.image !== null) {
                        process.resultFile = IoHelper.buildResultfilePath(info[0].folder, process.image.name);
                    } else {
                        process.resultFile = IoHelper.buildResultfilePath(info[0].folder, path.basename(info[0].folder));
                    }
                } else {
                    process.resultFile = IoHelper.buildResultfilePath(info[0].folder, path.basename(info[0].folder));
                }
                process.outputFolder = info[0].folder;
            } else {
                //found no information about that method
                return;
            }
        } catch (error) {
            return;
        }
    }

    static removeParamInfo(process: Process): void {
        let paramPath = nconf.get("paths:imageRootPath") + path.sep + process.rootFolder + path.sep + process.method + ".json";
        let data = {
            highlighters: process.inputHighlighters,
            parameters: hash(process.inputParameters)
        };
        try {
            fs.statSync(paramPath).isFile();
            let content = IoHelper.loadFile(paramPath);
            let info: any = {};
            if (_.filter(content, {
                    "parameters": data.parameters,
                    "highlighters": data.highlighters
                }).length > 0) {
                _.remove(content, {"parameters": data.parameters, "highlighters": data.highlighters});
                IoHelper.saveFile(paramPath, content, "utf8", null);
            }
        } catch (error) {
            return;
        }
    }

    static checkReservedParameters(parameter: string): boolean {
        let reservedParameters = nconf.get("reservedWords");
        return reservedParameters.indexOf(parameter) >= 0;
    }
}
