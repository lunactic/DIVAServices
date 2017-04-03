import { isNullOrUndefined } from 'util';
/**
 * Created by lunactic on 03.11.16.
 */
"use strict";

import * as _ from "lodash";
import * as fs from "fs-promise";
import * as nconf from "nconf";
import * as path from "path";
import * as hash from "object-hash";
import { DivaError } from "../models/divaError";
import { IoHelper } from "./ioHelper";
import { Logger } from "../logging/logger";
import { Process } from "../processingQueue/process";
import { Collection } from "../processingQueue/collection";
import IProcess = require("../processingQueue/iProcess");
import { File } from "../models/file";

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


    /**
     * 
     * @param collection the collection to match parameters for
     * @param req the incoming request 
     */
    static async matchCollectionParams(collection: Collection, req: any): Promise<void> {
        let self = this;
        return new Promise<void>((resolve, reject) => {
            let params = {};
            let outputParams = {};
            for (let neededParameter of collection.neededParameters) {
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
            }
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
                if (!isNullOrUndefined(found)) {
                    needed = Object.keys(found).length > 0;
                    if (needed) {
                        let value = element[key];
                        if (!this.isPathAbsolute(value)) {
                            //use relative file path to look up with collection / filename
                            let collection = value.split("/")[0];
                            let filename = value.split("/")[1];
                            data[key] = File.CreateFile(collection, filename);
                        } else {
                            //use absolute path (used only when testing a method)
                            data[key] = File.CreateFileFull(value);
                        }
                        //perform lookup to get the correct file path, create the correct data item out of it
                        _.remove(process.neededData, function (item: any) {
                            return Object.keys(item)[0] === key;
                        });
                    }
                } else {
                    Logger.log("error", "provided unnecessary data", "ParameterHelper");
                    return reject(new DivaError("provided unnecessary data with parameter: " + key, 500, "ParameterError"));
                }
            }
            if (process.neededData.length > 0) {
                Logger.log("error", "did not receive data for all data parameters", "ParameterHelper");
                return reject(new DivaError("did not receive data for all parameters", 500, "ParameterError"));
            }
            process.data = data;
            resolve();
        });
    }

    static async matchOrder(process: Process): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            for (let paramMatch of process.matchedParameters) {
                let found: boolean = false;
                //check if key is in global parameters
                let searchKey = Object.keys(paramMatch)[0];
                let globalParams = process.parameters.params[searchKey];
                if (!isNullOrUndefined(globalParams)) {
                    let replaceObj = _.find(process.matchedParameters, function (item: any) {
                        return Object.keys(item)[0] === searchKey;
                    });
                    replaceObj[searchKey] = globalParams;
                    found = true;
                }
                //check if key is in data parameters
                let dataParams = _.pickBy(process.data, function (value: any, key: string) {
                    return key === searchKey;
                });

                if (dataParams !== undefined && Object.keys(dataParams).length > 0) {

                    let replaceObj = _.find(process.matchedParameters, function (item: any) {
                        return Object.keys(item)[0] === searchKey;
                    });
                    found = true;
                    replaceObj[searchKey] = dataParams[searchKey];
                    if (!(IoHelper.fileExists((replaceObj[searchKey] as File).path))) {
                        return reject(new DivaError("non existing file: " + ((replaceObj[searchKey] as File).collection) + "/" + ((replaceObj[searchKey] as File).filename) + " for data parameter: " + searchKey, 500, "ParameterError"));
                    }
                }
                if (!found) {
                    return reject(new DivaError("Provided parameter: " + searchKey + " that ist not needed by the method", 500, "ParameterError"));
                }//if not found ==> throw error
            }
            resolve();
        });


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
    static async saveParamInfo(process: Process): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            let methodPath = nconf.get("paths:resultsPath") + path.sep + process.method + ".json";
            let content = [];
            let data: any = {};
            //TODO: incorporate the highlighter into the hash and store one single value (or add the hash as additional info to enable better computation of statistics)
            data = {
                highlighters: _.clone(process.inputHighlighters),
                parameters: _.clone(process.parameters),
                hash: hash(process.parameters),
                resultFile: process.resultFile,
                data: hash(process.data)
            };

            //turn everything into strings
            _.forIn(data.highlighters, function (value: string, key: string) {
                data.highlighters[key] = String(value);
            });

            Logger.log("info", "saveParamInfo", "ParameterHelper");
            Logger.log("info", JSON.stringify(process.parameters), "ParameterHelper");
            Logger.log("info", "hash: " + data.hash, "ParameterHelper");

            try {
                fs.statSync(methodPath).isFile();
                let content = IoHelper.openFile(methodPath);
                //only save the information if it is not already present
                if (_.filter(content, { "hash": data.hash, "highlighters": data.highlighters }).length === 0) {
                    content.push(data);
                    await IoHelper.saveFile(methodPath, content, "utf8");
                }
                resolve();
            } catch (error) {
                content.push(data);
                await IoHelper.saveFile(methodPath, content, "utf8");
                resolve();
            }
        });
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
    static loadParamInfo(proc: Process): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let paramPath = nconf.get("paths:resultsPath") + path.sep + proc.method + ".json";
            let data = {
                highlighters: _.clone(proc.inputHighlighters),
                parameters: _.clone(proc.parameters),
                hash: hash(proc.parameters),
                resultFile: proc.resultFile,
                data: hash(proc.data)
            };
            try {
                await fs.statSync(paramPath).isFile();
                let content = IoHelper.openFile(paramPath);
                let info: any = {};
                if ((info = _.filter(content, {
                    "highlighters": data.highlighters,
                    "data": data.data
                })).length > 0) {
                    //found some method information
                    proc.resultFile = info[0].resultFile;
                    proc.outputFolder = info[0].folder;
                    proc.resultLink = proc.buildGetUrl();
                    resolve();
                } else {
                    proc.resultFile = null;
                    resolve();
                }
            } catch (error) {
                //resolve for file not found, reject for all other errors
                if (error.code === "ENOENT") {
                    proc.resultFile = null;
                    resolve();
                } else {
                    return reject(new DivaError(error.message, 500, "ParameterHelper"));
                }
            }
        });
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
    static async removeParamInfo(process: Process): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let paramPath = nconf.get("paths:resultsPath") + path.sep + process.method + ".json";
            let data = {
                highlighters: process.inputHighlighters,
                hash: hash(process.parameters)
            };
            try {
                await fs.statSync(paramPath).isFile();
                let content = IoHelper.openFile(paramPath);
                if (_.filter(content, {
                    "hash": data.hash,
                    "highlighters": data.highlighters
                }).length > 0) {
                    _.remove(content, { "hash": data.hash, "highlighters": data.highlighters });
                    await IoHelper.saveFile(paramPath, content, "utf8");
                    resolve();
                }
            } catch (error) {
                return reject(new DivaError(error.message, 500, "ParameterHelper"));
            }
        });
    }

    /**
     * Checks if a parameter value is in the list of system wide reserved keys
     * 
     * @static
     * @param {string} parameter the name of the parameter
     * @returns {boolean} indicating whether the parameter is reserved or not
     * 
     * @memberOf ParameterHelper
     */
    static checkReservedParameters(parameter: string): boolean {
        let reservedParameters = nconf.get("reservedWords");
        return reservedParameters.indexOf(parameter) >= 0;
    }

    static isPathAbsolute(path: string): boolean {
        return /^(?:\/|[a-z]+:\/\/)/.test(path);
    }
}
