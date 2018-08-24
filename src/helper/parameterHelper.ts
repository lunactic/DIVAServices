import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as mime from 'mime';
import * as nconf from 'nconf';
import * as hash from 'object-hash';
import * as path from 'path';
import { isNullOrUndefined, promisify } from "util";
import { Logger } from "../logging/logger";
import { DivaCollection } from '../models/divaCollection';
import { DivaError } from "../models/divaError";
import { DivaFile } from "../models/divaFile";
import { Collection } from "../processingQueue/collection";
import { IProcess } from '../processingQueue/iProcess';
import { Process } from "../processingQueue/process";
import { FileHelper } from './fileHelper';
import { IoHelper } from "./ioHelper";

/**
 * Created by Marcel Würsch on 03.11.16.
 */
"use strict";
require("natural-compare-lite");

var sizeOf = promisify(require('image-size'));

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
     * Selects the default value for a parameter
     * 
     * @param param The parameter object
     */
    static getDefaultParamValue(param: any): string {
        switch (Object.keys(param)[0]) {
            case 'select':
                return param.select.options.values[param.select.options.default];
            default:
                return param[Object.keys(param)[0]].options.default;
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
        if (parameter.includes('outputFolder')) {
            return process.outputFolder;
        } else if (parameter.includes('host')) {
            return nconf.get("server:rootUrl");
        } else if (parameter.includes('outputImage')) {
            return "##outputImage##";
        } else if (parameter.includes('mcr2014b')) {
            return nconf.get("paths:mcr2014b");
        }
    }



    /**
     * Expands possible existing wildcards in data parameters
     * (e.g. COLLECTIONNAME/*) 
     * @static
     * @param {any[]} inputData the data parameters that were provided 
     * @returns {Promise<any[]>} the data parameters expanded to single files
     * 
     * @memberOf ParameterHelper
     */
    static async expandDataWildcards(inputData: any[]): Promise<any[]> {
        return new Promise<any[]>(async (resolve, reject) => {
            let expandedInputData: any[] = [];
            for (let element of inputData) {
                let newMap: Map<string, any[]> = new Map();
                let allExpanded: boolean = true;
                for (let key in element) {
                    if (element.hasOwnProperty(key)) {
                        let value = element[key];
                        if (value.indexOf("*") !== -1) {
                            let collection = value.split("/")[0];

                            if (FileHelper.checkCollectionAvailable(collection)) {
                                let images = IoHelper.readFolder(nconf.get("paths:filesPath") + path.sep + collection + path.sep + "original");
                                images.forEach((value, index, array) => {
                                    array[index] = collection + "/" + value;
                                });
                                images.sort(String.naturalCompare);
                                newMap.set(key, images);
                            } else {
                                reject(new DivaError("Collection: " + collection + " does not exist!", 500, "CollectionNotExistingError"));
                            }
                        } else {
                            let values = [value];
                            newMap.set(key, values);
                            allExpanded = false;
                        }
                    }
                }
                if (allExpanded) {
                    try {
                        let size = await this.checkArrayLengths(newMap);
                        for (var index = 0; index < size; index++) {
                            let newRequest = {};
                            for (let [key, value] of newMap) {
                                newRequest[key] = value[index];
                            }
                            expandedInputData.push(newRequest);
                        }
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    let maxSize = await this.getMaxArrayLength(newMap);
                    for (var index = 0; index < maxSize; index++) {
                        let newRequest = {};
                        for (let [key, value] of newMap) {
                            if (value.length > 1) {
                                newRequest[key] = value[index];
                            } else {
                                newRequest[key] = value[0];
                            }
                        }
                        expandedInputData.push(newRequest);
                    }
                }
            }
            resolve(expandedInputData);
        });
    }

    /**
     * 
     * @param collection the collection to match parameters for
     * @param req the incoming request 
     */
    static async matchCollectionParams(collection: Collection, req: any): Promise<void> {
        let self = this;
        return new Promise<void>(async (resolve, reject) => {
            let params = {};
            let outputParams = {};
            for (let neededParameter of collection.neededParameters) {
                let paramKey = _.keys(neededParameter)[0];
                let paramValue = neededParameter[paramKey];
                if (self.checkReservedParameters(paramKey) || self.checkReservedParameters(Object.keys(paramValue)[0])) {
                    switch (Object.keys(paramValue)[0]) {
                        case 'highlighter':
                            if (!isNullOrUndefined(collection.inputHighlighters.type)) {
                                params[paramKey] = self.getHighlighterParamValues(collection.inputHighlighters.type, collection.inputHighlighters.segments);
                            } else {
                                params[paramKey] = await self.getHighlighterParamValuesFromFile(paramValue.highlighter.type, collection.inputData[0]);
                            }
                            break;
                        default:
                            params[paramKey] = self.getReservedParamValue(paramKey, collection, req);
                            break;
                    }
                } else {
                    let value = self.getParamValue(paramKey, collection.inputParameters);
                    if (!isNullOrUndefined(value)) {
                        switch (Object.keys(paramValue)[0]) {
                            case "number":
                                if (paramValue.number.options !== null || paramValue.number.options !== undefined) {
                                    if (paramValue.number.options.min !== null || paramValue.number.options.min !== undefined) {
                                        if (value < paramValue.number.options.min) {
                                            reject(new DivaError("incompatile input for -- " + paramKey + " -- provided value " + value + " which is smaller than the minimal allowed value of " + paramValue.number.options.min,
                                                500, "ParameterError"));
                                            return;
                                        }
                                    }
                                    if (paramValue.number.options.max !== null || paramValue.number.options.max !== undefined) {
                                        if (value > paramValue.number.options.max) {
                                            reject(new DivaError("incompatile input for -- " + paramKey + " -- provided value " + value + " which is larger than the maximal allowed value of " + paramValue.number.options.max,
                                                500, "ParameterError"));
                                            return;
                                        }
                                    }
                                }
                                break;
                        }
                        params[paramKey] = value;
                        outputParams[paramKey] = value;
                    } else {
                        if (!paramValue[Object.keys(paramValue)[0]].options.required) {
                            params[paramKey] = self.getDefaultParamValue(paramValue);
                        } else {
                            reject(new DivaError("Did not receive a parameter value for: " + paramKey + " that is required by the method", 500, "MissingParameter"));
                            return;
                        }
                    }
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
                        switch (Object.keys(found[key])[0]) {
                            case "file":
                                let values = value.split("/");
                                let collection = values[values.length - 2];
                                let filename = values[values.length - 1];
                                //check if the mime-type is matching
                                if (!found[key].file.options.mimeTypes.allowed.includes(mime.getType(filename))) {
                                    reject(new DivaError("incompatile input for -- " + key + " -- expected file of type(s) " + JSON.stringify(found[key].file.options.mimeTypes.allowed, null, " ").replace(/\n/g, '').replace(/\"/g, '').replace(/\s/g, '') + " but found type " + mime.getType(filename),
                                        500, "ParameterError"));
                                    return;
                                }
                                //perform lookup to get the correct file path, create the correct data item out of it
                                if (!this.isPathAbsolute(value)) {
                                    //use relative file path to look up with collection / filename
                                    data[key] = DivaFile.CreateFile(collection, filename);
                                } else {
                                    //use absolute path (used only when testing a method)
                                    data[key] = DivaFile.CreateFileFullTest(value);
                                }
                                break;
                            case "folder":
                                if (!this.isPathAbsolute(value)) {
                                    let collection = value;
                                    data[key] = DivaCollection.CreateCollection(collection);
                                } else {
                                    data[key] = DivaCollection.CreateCollectionFull(value);
                                }
                                break;
                        }
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
        return new Promise<void>(async (resolve, reject) => {
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
                    if (replaceObj[searchKey] instanceof DivaFile) {
                        if (!(await IoHelper.fileExists((replaceObj[searchKey] as DivaFile).path))) {
                            reject(new DivaError("non existing file: " + ((replaceObj[searchKey] as DivaFile).collection) + "/" + ((replaceObj[searchKey] as DivaFile).filename) + " for data parameter: " + searchKey, 500, "ParameterError"));
                            return;
                        }
                    }
                }
                if (!found) {
                    let needed = _.find(process.neededParameters, function (item: any) {
                        return Object.keys(item)[0] === searchKey;
                    });
                    if (isNullOrUndefined(needed)) {
                        reject(new DivaError("Provided parameter: " + searchKey + " that is not needed by the method", 500, "ParameterError"));
                        return;
                    } else {
                        reject(new DivaError("Did not receive data for parameter: " + searchKey + " that is needed by the method", 500, "ParameterError"));
                        return;
                    }
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

    static async getHighlighterParamValuesFromFile(neededHighlighter: string, input: any): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            let identifier = input[Object.keys(input)[0]];
            let parts = identifier.split("/");
            let filePath = nconf.get("paths:filesPath") + path.sep + parts[0] + path.sep + "original" + path.sep + parts[1];
            try {
                let dimensions = await sizeOf(filePath);
                console.log(dimensions.width, dimensions.height);
                resolve('1 1 ' + dimensions.width + ' 1 ' + dimensions.width + ' ' + dimensions.height + ' 1 ' + dimensions.height);
            } catch (error) {
                reject(error);
                Logger.log("error", error, "ParameterHelper::getHighlighterParamValuesFromFile");
            }
        });

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
        let methodPath = nconf.get("paths:resultsPath") + path.sep + process.method + ".json";
        let content = [];
        let data: any = {};
        //TODO: incorporate the highlighter into the hash and store one single value (or add the hash as additional info to enable better computation of statistics)
        let parameters = _.clone(process.parameters.outputParams);
        data = {
            highlighters: _.clone(process.inputHighlighters),
            highlighterHash: hash.MD5(process.inputHighlighters),
            parameters: _.clone(parameters),
            paramHash: hash.MD5(process.parameters.outputParams),
            resultFile: process.resultFile,
            dataHash: hash.MD5(process.data)
        };

        //turn everything into strings
        _.forIn(data.highlighters, function (value: string, key: string) {
            data.highlighters[key] = String(value);
        });

        Logger.log("info", "saveParamInfo", "ParameterHelper");
        //Logger.log("info", JSON.stringify(process.parameters), "ParameterHelper");
        //Logger.log("info", "hash: " + data.hash, "ParameterHelper");
        if (await IoHelper.fileExists(methodPath)) {
            let content = IoHelper.readFile(methodPath);
            //only save the information if it is not already present
            if (_.filter(content, _.filter(content, {
                "highlighterHash": data.highlighterHash,
                "dataHash": data.dataHash,
                "paramHash": data.paramHash
            })).length === 0) {
                content.push(data);
                return IoHelper.saveFile(methodPath, content, "utf8");
            }
        } else {
            content.push(data);
            return IoHelper.saveFile(methodPath, content, "utf8");
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
    static loadParamInfo(proc: Process, noCache: boolean): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let paramPath = nconf.get("paths:resultsPath") + path.sep + proc.method + ".json";
            let parameters = _.clone(proc.parameters.outputParams);
            let data = {
                highlighters: _.clone(proc.inputHighlighters),
                highlighterHash: hash.MD5(proc.inputHighlighters),
                parameters: parameters,
                paramHash: hash.MD5(proc.parameters.outputParams),
                resultFile: proc.resultFile,
                dataHash: hash.MD5(proc.data)
            };
            try {
                await fs.statSync(paramPath).isFile();
                let content = IoHelper.readFile(paramPath);
                let info: any = {};
                if ((info = _.filter(content, {
                    "highlighterHash": data.highlighterHash,
                    "dataHash": data.dataHash,
                    "paramHash": data.paramHash
                })).length > 0 && !noCache) {
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
                highlighterHash: hash.MD5(process.inputHighlighters),
                dataHash: hash.MD5(process.data),
                paramHash: hash.MD5(process.parameters.outputParams)
            };
            try {
                await fs.statSync(paramPath).isFile();
                let content = IoHelper.readFile(paramPath);
                if (_.filter(content, {
                    "dataHash": data.dataHash,
                    "highlighterHash": data.highlighterHash,
                    "paramHash": data.paramHash
                }).length > 0) {
                    _.remove(content, { "dataHash": data.dataHash, "highlighterHash": data.highlighterHash });
                    await IoHelper.saveFile(paramPath, content, "utf8");
                    resolve();
                } else {
                    resolve();
                }
            } catch (error) {
                reject(new DivaError(error.message, 500, "ParameterHelper"));
                return;
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

    /**
     * Assert that all arrays in a Map have the same size
     * 
     * @private
     * @static
     * @param {Map<string, string[]>} map the Map object to analyze
     * @returns {Promise<Number>} the size of the array
     * 
     * @memberOf ParameterHelper
     */
    private static checkArrayLengths(map: Map<string, string[]>): Promise<Number> {
        return new Promise<Number>((resolve, reject) => {
            let size: number = -1;
            for (let [key, value] of map) {
                if (size === -1) {
                    size = value.length;
                }
                if (value.length !== size) {
                    reject(new DivaError("Not all data parameters contain the same amount of files", 500, "ParameterError"));
                }
            }
            resolve(size);
        });
    }

    /**
     * Compute the size of the largest array in a Map
     * 
     * @private
     * @static
     * @param {Map<string, string[]>} map the map object to analyze
     * @returns {Promise<Number>} the size of the largest array
     * 
     * @memberOf ParameterHelper
     */
    private static getMaxArrayLength(map: Map<string, string[]>): Promise<Number> {
        return new Promise<Number>((resolve, reject) => {
            let maxSize = 0;
            for (let [key, value] of map) {
                if (value.length > 1 && value.length !== maxSize) {
                    reject(new DivaError("Invalid combination of parameter sizes", 500, "ParameterError"));
                }
                if (value.length > maxSize) {
                    maxSize = value.length;
                }
            }
            resolve(maxSize);
        });
    }
}
