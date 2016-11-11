"use strict";
/**
 * Created by lunactic on 07.11.16.
 */

import * as _ from "lodash";
import {AlgorithmManagement} from "../management/algorithmManagement";
import * as fs from "fs";
import * as nconf from "nconf";
import * as path from "path";
import {Collection} from "../processingQueue/collection";
import {Statistics} from "../statistics/statistics";
import {ParameterHelper} from "../helper/parameterHelper";
import {Process} from "../processingQueue/process";
import {ResultHelper} from "../helper/resultHelper";
import {ImageHelper} from "../helper/imageHelper";
import {ServicesInfoHelper} from "../helper/servicesInfoHelper";
import {IoHelper} from "../helper/ioHelper";

export class GetHandler {

    static handleRequest(req: any, callback: Function): void {
        if (Object.keys(req.query).length !== 0) {
            GetHandler.getWithQuery(req, callback);
        } else {
            fs.readFile(nconf.get("paths:jsonPath") + req.originalUrl + "/info.json", "utf8", function (err: any, data: any) {
                if (err != null) {
                    let algo = AlgorithmManagement.getStatusByRoute(req.originalUrl);
                    let error = null;
                    if (algo != null) {
                        error = GetHandler.createError(algo.status.statusCode, algo.status.statusMessage);
                    } else {
                        error = GetHandler.createError(404, "This algorithm is not available");
                    }
                    callback(error, null);
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
                    callback(null, data);
                }
            });
        }
    }

    private static getWithQuery(req: any, callback: Function) {
        let serviceInfo = ServicesInfoHelper.getInfoByPath(req.originalUrl);
        let queryParams = _.clone(req.query);
        let neededParams = _.clone(serviceInfo.parameters);

        if (queryParams["md5"] != null) {
            ImageHelper.imageExists(queryParams.md5, function (err: any, data: any) {
                if (err != null) {
                    let error = GetHandler.createError(404, "DivaImage not available");
                    callback(error, null);
                } else {
                    if (data.imageAvailable) {
                        let images = ImageHelper.loadImagesMd5(queryParams.md5);
                        for (let image of images) {
                            let process = new Process();
                            process.image = image;
                            GetHandler.prepareQueryParams(process, queryParams);
                            process.parameters = ParameterHelper.matchParams(process, req);
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
                        }
                        callback(GetHandler.createError(404, "This result is not available"), null);
                    }
                }
            });
        } else if (queryParams["rootFolder"] != null) {
            let process = new Process();
            GetHandler.prepareQueryParams(process, queryParams);
            process.neededParameters = serviceInfo.parameters;
            GetHandler.prepareNeededParameters(process);
            process.parameters = ParameterHelper.matchParams(process, req);
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
        } else {
            let error = GetHandler.createError(500, "Could not parse this request");
            callback(error, null);
        }
    }

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

    private static prepareNeededParameters(process: Process): void {
        for (let reservedWord of nconf.get("reservedWords")) {
            _.unset(process.neededParameters, reservedWord);
        }
    }

    private static createError(status: number, message: string): any {
        let error = {
            statusCode: status,
            statusMessage: message
        };
        return error;
    }
}