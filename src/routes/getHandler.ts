"use strict";
/**
 * Created by lunactic on 07.11.16.
 */

import { AlgorithmManagement } from "../management/algorithmManagement";
import * as fs from "fs";
import * as nconf from "nconf";
import * as express from "express";
import { Statistics } from "../statistics/statistics";

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
     * 
     * @memberOf GetHandler
     */
    static async handleRequest(req: express.Request): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {

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
        });

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