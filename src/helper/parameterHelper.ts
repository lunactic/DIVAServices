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
import { IoHelper } from "./ioHelper";
import { Logger } from "../logging/logger";
import { Process } from "../processingQueue/process";
import { Collection } from "../processingQueue/collection";
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
    static getReservedParamValue(parameter: string, process: IProcess, req: any): string {
        switch (parameter) {
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


    static async matchCollectionParams(collection: Collection, req: any): Promise<void> {
        let self = this;
        return new Promise<void>((resolve, reject) => {
            let params = {};
            let outputParams = {};
            collection.neededParameters.forEach(function (neededParameter: any, key: any) {
                let paramKey = _.keys(neededParameter)[0];
                let paramValue = neededParameter[paramKey];
                if (self.checkReservedParameters(paramKey) || self.checkReservedParameters(paramValue)) {
                    switch (paramValue) {
                        case 'highlighter':
                            params[paramKey] = self.getHighlighterParamValues(collection.inputHighlighters.type, collection.inputHighlighters.segments);
                            break;
                        default:
                            params[paramKey] = self.getReservedParamValue(paramKey, collection, req);
                    }
                } else {
                    let value = self.getParamValue(paramKey, collection.inputParameters);
                    params[paramKey] = value;
                    outputParams[paramKey] = value;
                }
            });
            let result = {
                params: params,
                outputParams: outputParams
            };
            collection.parameters = result;
            resolve();
        });

    }

    static async matchProcessData(process: Process, element: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let data = {};
            let needed: boolean = true;
            for (let key of Object.keys(element)) {
                let found: any = _.find(process.neededData, function (item: any) {
                    return Object.keys(item)[0] === key;
                });
                needed = Object.keys(found).length > 0;
                if (needed) {
                    let value = element[key];
                    data[key] = value;
                    _.remove(process.neededData, function (item: any) {
                        return Object.keys(item)[0] === key;
                    });
                } else {
                    Logger.log("error", "provided unnecessary data", "ParameterHelper");
                }
            }
            if (process.neededData.length > 0) {
                Logger.log("error", "did not receive data for all data parameters", "ParameterHelper");
            }
            process.data = data;
            resolve();
        });
    }

    static async matchOrder(process: Process): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            for (let paramMatch of process.matchedParameters) {
                //check if key is in global parameters
                let searchKey = Object.keys(paramMatch)[0];
                let globalParams = _.find(process.parameters.params, function (item: any) {
                    return Object.keys(item)[0] === searchKey;
                });
                if (globalParams != undefined && Object.keys(globalParams).length > 0) {
                                        let replaceObj = _.find(process.matchedParameters, function(item: any){
                        return Object.keys(item)[0] === searchKey;
                    });
                    replaceObj[searchKey] = globalParams[searchKey];
                }
                //check if key is in data parameters
                let dataParams = _.pickBy(process.data, function(value: any, key: string){
                    return key === searchKey;
                });

                if (dataParams != undefined && Object.keys(dataParams).length > 0) {
                    let replaceObj = _.find(process.matchedParameters, function(item: any){
                        return Object.keys(item)[0] === searchKey;
                    });
                    replaceObj[searchKey] = dataParams[searchKey];
                }
                //if not found ==> throw error
                
            }
            resolve();
        })


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
                parameters: _.clone(process.inputParameters),
                hash: hash(process.inputParameters),
                folder: process.outputFolder
            };
        } else {
            data = {
                highlighters: {},
                parameters: _.clone(process.inputParameters),
                hash: hash(process.inputParameters),
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
            if (_.filter(content, { "parameters": data.parameters, "highlighters": data.highlighters }).length > 0) {
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
            parameters: _.clone(proc.inputParameters),
            highlighters: proc.inputHighlighters,
            hash: hash(proc.inputParameters)
        };
        try {
            fs.statSync(paramPath).isFile();
            let content = IoHelper.openFile(paramPath);
            let info: any = {};
            if ((info = _.filter(content, {
                "hash": data.hash,
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
            hash: hash(process.inputParameters)
        };
        try {
            fs.statSync(paramPath).isFile();
            let content = IoHelper.openFile(paramPath);
            let info: any = {};
            if (_.filter(content, {
                "parameters": data.hash,
                "highlighters": data.highlighters
            }).length > 0) {
                _.remove(content, { "parameters": data.hash, "highlighters": data.highlighters });
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
