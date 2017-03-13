"use strict";
/**
 * Created by lunactic on 07.11.16.
 */

import * as _ from "lodash";
import { AlgorithmManagement } from "../management/algorithmManagement";
import * as fs from "fs";
import * as nconf from "nconf";
import * as path from "path";
import * as express from "express";
import { Collection } from "../processingQueue/collection";
import { Statistics } from "../statistics/statistics";
import { ParameterHelper } from "../helper/parameterHelper";
import { Process } from "../processingQueue/process";
import { ResultHelper } from "../helper/resultHelper";
import { FileHelper } from "../helper/fileHelper";
import { ServicesInfoHelper } from "../helper/servicesInfoHelper";
import { IoHelper } from "../helper/ioHelper";

/**
 * handler for all get requests that are not handled by a specific route
 * 
 * @export
 * @class GetHandler
 */
export class GetHandler {

    /**
     * request handler
     * 
     * @static
     * @param {*} req the incoming GET request
     * @param {Function} callback the callback function
     * 
     * @memberOf GetHandler
     */
    static async handleRequest(req: express.Request) {
        return new Promise<any>(async (resolve, reject) => {
            if (Object.keys(req.query).length !== 0) {
                try {
                    let response = await GetHandler.getWithQuery(req);
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            } else {
                fs.readFile(nconf.get("paths:jsonPath") + req.originalUrl + "info.json", "utf8", function (err: any, data: any) {
                    if (err != null) {
                        let algo = AlgorithmManagement.getStatusByRoute(req.originalUrl);
                        let error = null;
                        if (algo != null) {
                            error = GetHandler.createError(algo.status.statusCode, algo.status.statusMessage);
                        } else {
                            error = GetHandler.createError(404, "This algorithm is not available");
                        }
                        reject(error);
                    } else {
                        data = data.replace(new RegExp("\\$BASEURL\\$", "g"), nconf.get("server:rootUrl"));
                        data = JSON.parse(data);

                        //add additional information if available
                        if (data.general != null && data.general.expectedRuntime == null) {
                            data.general.expectedRuntime = Statistics.getMeanExecutionTime(req.originalUrl);
                        }
                        if (data.general != null && data.general.executions == null) {
                            data.general.executions = Statistics.getNumberOfExecutions(req.originalUrl);
                        }
                        resolve(data);
                    }
                });
            }
        });

    }

    /**
     * handler for GET requests with query parameters
     * 
     * @private
     * @static
     * @param {*} req the incoming GET request
     * @param {Function} callback the callback function
     * 
     * @memberOf GetHandler
     */
    private static async getWithQuery(req: any) {
        //TODO: this is outdated and could need some refactoring

        let serviceInfo = ServicesInfoHelper.getInfoByPath(req.originalUrl);
        let queryParams = _.clone(req.query);
        let neededParams = _.clone(serviceInfo.parameters);

        //check if there is an md5 hash referenced
        if (queryParams["md5"] != null) {
            try {
                var data = await FileHelper.fileExists(queryParams.md5);
                if (data.imageAvailable) {
                    let images = FileHelper.loadFilesMd5(queryParams.md5);
                    for (let image of images) {
                        let process = new Process();
                        //process.image = image;
                        GetHandler.prepareQueryParams(process, queryParams);
                        /*ParameterHelper.matchParams(process, req, function (parameters) {
                            process.parameters = parameters;
                            process.method = serviceInfo.service;
                            process.rootFolder = image.folder.split(path.sep)[image.folder.split(path.sep).length - 2];
                            //TODO is this needed in the futur, when everything is starting from the point of acollection?
                            if (ResultHelper.checkProcessResultAvailable(process)) {
                                process.result = ResultHelper.loadResult(process);
                                if (!(process.result.hasOwnProperty("status"))) {
                                    process.result["status"] = "done";
                                }
                                callback(null, process.result);
                            }
                        });*/
                    }
                    Promise.reject(GetHandler.createError(404, "This result is not available"));
                }
            } catch (error) {
                let err = GetHandler.createError(404, "DivaImage not available");
                Promise.reject(error);
            }
            //check if a root folder is referenced
        } else if (queryParams["rootFolder"] != null) {
            let process = new Process();
            GetHandler.prepareQueryParams(process, queryParams);
            process.neededParameters = serviceInfo.parameters;
            GetHandler.prepareNeededParameters(process);
            /*ParameterHelper.matchParams(process, req, function (parameters) {
                process.parameters = parameters;
                process.method = serviceInfo.service;
                process.rootFolder = queryParams["rootFolder"];
                if (ResultHelper.checkProcessResultAvailable(process)) {
                    process.result = ResultHelper.loadResult(process);
                    if (queryParams.requireOutputImage === false && process.result["image"] != null) {
                        delete process.result["image"];
                    }
                    if (!(process.result.hasOwnProperty("status"))) {
                        process.result["status"] = "done";
                    }
                    callback(null, process.result);
                } else {
                    let error = GetHandler.createError(400, "Malformed request");
                    callback(error, null);
                }
            });*/
        } else {
            let error = GetHandler.createError(500, "Could not parse this request");
            Promise.reject(error);
        }
    }

    /**
     * prepare query parameters
     * 
     * removes unnecessary parameters
     * 
     * @private
     * @static
     * @param {Process} proc the process
     * @param {*} queryParams the query parameters
     * 
     * @memberOf GetHandler
     */
    private static prepareQueryParams(proc: Process, queryParams: any): void {
        proc.inputParameters = _.clone(queryParams);
        _.unset(proc.inputParameters, "md5");
        _.unset(proc.inputParameters, "highlighter");
        _.unset(proc.inputParameters, "highlighterType");
        _.unset(proc.inputParameters, "collection");
        _.unset(proc.inputParameters, "rootFolder");

        let params = {};
        if (queryParams.highlighter != null) {
            params = JSON.parse(queryParams.highlighter);
            proc.inputHighlighters = {
                type: queryParams.highlighterType,
                segments: String(params),
                closed: "true"
            };
        } else {
            proc.inputHighlighters = {};
        }
    }

    /**
     * remove reserved words from the needed parameters
     * 
     * @private
     * @static
     * @param {Process} process the process
     * 
     * @memberOf GetHandler
     */
    private static prepareNeededParameters(process: Process): void {
        for (let reservedWord of nconf.get("reservedWords")) {
            _.unset(process.neededParameters, reservedWord);
        }
    }

    /**
     * create an error message
     * 
     * @private
     * @static
     * @param {number} status the error status
     * @param {string} message the error message
     * @returns {*}
     * 
     * @memberOf GetHandler
     */
    private static createError(status: number, message: string): any {
        let error = {
            statusCode: status,
            statusMessage: message
        };
        return error;
    }
}