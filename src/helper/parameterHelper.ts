/**
 * Created by lunactic on 03.11.16.
 */
"use strict";

import * as async from "async";
import * as _ from "lodash";
import * as fs from "fs";
import * as nconf from "nconf";
import * as path from "path";
import * as hash from "object-hash";
import {IoHelper} from "./ioHelper";
import {Logger} from "../logging/logger";
import {Process} from "../processingQueue/process";
import IProcess = require("../processingQueue/iProcess");

/**
 * Helping class for everything related to help matching parameters to the executables
 * 
 * @export
 * @class ParameterHelper
 */
export class ParameterHelper {
    static getParamValue(parameter: string, inputParameter: string): string {
        if (inputParameter.hasOwnProperty(parameter)) {
            return inputParameter[parameter];
        } else {
            return null;
        }
    }

    /**
     * 
     * get the values for reserved parameters defined in the conf/server.xxx.json file
     * 
     * @static
     * @param {string} parameter the parameter name
     * @param {Process} process the process to run
     * @param {*} req the incoming POST request
     * @returns {string} the parameter value
     * 
     * @memberOf ParameterHelper
     */
    static getReservedParamValue(parameter: string, process: Process, req: any): string {
        switch (parameter) {
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
            case "outputImage":
                return "##outputImage##";
            case "mcr2014b":
                return nconf.get("paths:mcr2014b");
        }
    }

    /**
     * perform parameter matching
     * 
     * this method checks what parameters are needed and matches them to the provided parameters from the POST request
     * 
     * @static
     * @param {Process} process the process to execute
     * @param {*} req the incoming POST request
     * @param {Function} cb the callback function
     * 
     * @memberOf ParameterHelper
     */
    static matchParams(process: Process, req: any, cb: Function): void {
        let params = {};
        let outputParams = {};
        let self = this;
        process.neededParameters.forEach(function (neededParameter: any, key: any) {
            //build parameters
            let paramKey = _.keys(neededParameter)[0];
            let paramValue = neededParameter[paramKey];
            if (self.checkReservedParameters(paramKey) || self.checkReservedParameters(paramValue)) {
                //check if highlighter
                let value = self.getParamValue(paramKey, process.inputParameters);
                switch (paramValue) {
                    case 'inputFile':
                        let filename = IoHelper.downloadFileSync(value, process.outputFolder, path.basename(value));
                        params[paramKey] = filename;
                        outputParams[paramKey] = filename;
                        break;
                    case 'highlighter':
                        params[paramKey] = self.getHighlighterParamValues(process.inputHighlighters.type, process.inputHighlighters.segments);
                        break;
                    case 'inputImage':
                        params[paramKey] = process.inputImageUrl;
                        outputParams[paramKey] = process.inputImageUrl;
                        break;
                    default:
                        params[paramKey] = self.getReservedParamValue(paramKey, process, req);
                        break;
                }
            } else {
                //handle json
                let value = self.getParamValue(paramKey, process.inputParameters);
                if (value != null) {
                    if (paramValue === "json") {
                        //TODO Fix here with counter
                        let jsonFile = process.outputFolder + path.sep + "jsonInput.json";
                        IoHelper.saveFile(jsonFile, value, "utf8", null);
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
        });
        let result = {
            params: params,
            outputParams: outputParams
        };
        cb(result);
    }

    /**
     * Get parameter values for highlighters
     * 
     * This method will return the parameter value for highlighters currently these are the following:
     * 
     * - rectangle: topLeftX topLeftY topRightX topRightY bottomRightX bottomRightY bottomLeftX bottomRightY
     * - polygon: X1 Y1 X2 Y2 ... XN YN
     * - circle: centerX centerY radius
     * 
     * @static
     * @param {string} neededHighlighter the name of the highlighter
     * @param {*} inputHighlighter the provided highlighter values
     * @returns {*} the correct values as string
     * 
     * @memberOf ParameterHelper
     */
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

    /**
     * get the method name 
     * 
     * @static
     * @param {string} algorithm the name of the algorithm
     * @returns {string} the algorithm name for DIVAServices
     * 
     * @memberOf ParameterHelper
     */
    static getMethodName(algorithm: string): string {
        return algorithm.replace(/\//g, "");
    }

    /**
     * Save the parameter information to enable finding of already computed parameters
     * 
     * @static
     * @param {Process} process the process with all parameter information
     * @returns {void}
     * 
     * @memberOf ParameterHelper
     */
    static saveParamInfo(process: Process): void {
        if (process.result != null) {
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
        if (process.inputHighlighters != null) {
            //TODO: incorporate the highlighter into the hash and store one single value (or add the hash as additional info to enable better computation of statistics)
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
            let content = IoHelper.openFile(methodPath);
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

    /**
     * Load parameter information for a process
     * 
     * Checks if some parameter information is already available
     * 
     * @static
     * @param {IProcess} proc the process to search information for
     * @returns {void}
     * 
     * @memberOf ParameterHelper
     */
    static loadParamInfo(proc: IProcess): void {
        let paramPath = "";
        if (proc.hasImages) {
            paramPath = nconf.get("paths:imageRootPath") + path.sep + proc.rootFolder + path.sep + proc.method + ".json";
        } else {
            paramPath = nconf.get("paths:dataRootPath") + path.sep + proc.rootFolder + path.sep + proc.method + ".json";
        }

        let data = {
            highlighters: proc.inputHighlighters,
            parameters: hash(proc.inputParameters)
        };
        try {
            fs.statSync(paramPath).isFile();
            let content = IoHelper.openFile(paramPath);
            let info: any = {};
            if ((info = _.filter(content, {
                    "parameters": data.parameters,
                    "highlighters": data.highlighters
                })).length > 0) {
                //found some method information
                if (proc.hasImages) {
                    if (proc.image != null) {
                        proc.resultFile = IoHelper.buildResultfilePath(info[0].folder, proc.image.name);
                    } else {
                        proc.resultFile = IoHelper.buildResultfilePath(info[0].folder, path.basename(info[0].folder));
                    }
                } else {
                    proc.resultFile = IoHelper.buildResultfilePath(info[0].folder, path.basename(info[0].folder));
                }
                proc.outputFolder = info[0].folder;
            } else {
                //found no information about that method
                return;
            }
        } catch (error) {
            return;
        }
    }

    /**
     * 
     * Removes parameter information for a process
     * 
     * @static
     * @param {Process} process the process to delete parameter values for
     * @returns {void}
     * 
     * @memberOf ParameterHelper
     */
    static removeParamInfo(process: Process): void {
        let paramPath = nconf.get("paths:imageRootPath") + path.sep + process.rootFolder + path.sep + process.method + ".json";
        let data = {
            highlighters: process.inputHighlighters,
            parameters: hash(process.inputParameters)
        };
        try {
            fs.statSync(paramPath).isFile();
            let content = IoHelper.openFile(paramPath);
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

    /**
     * Checks if a parameter value is in the list of system wide reserved keys
     * 
     * @static
     * @param {string} parameter the name of the parameter
     * @returns {boolean} indicating wheter the parameter is reserved or not
     * 
     * @memberOf ParameterHelper
     */
    static checkReservedParameters(parameter: string): boolean {
        let reservedParameters = nconf.get("reservedWords");
        return reservedParameters.indexOf(parameter) >= 0;
    }
}
