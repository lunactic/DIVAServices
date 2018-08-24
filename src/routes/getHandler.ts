"use strict";
/**
 * Created by Marcel Würsch on 07.11.16.
 */

import * as express from "express";
import * as fs from "fs-extra";
import * as nconf from "nconf";
import * as path from "path";
import { AlgorithmManagement } from "../management/algorithmManagement";
import { DivaError } from '../models/divaError';
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
            try {                
                let data = await fs.readFile(nconf.get("paths:jsonPath") + req.originalUrl + path.sep + "info.json", "utf8");
                data = data.replace(new RegExp("\\$BASEURL\\$", "g"), nconf.get("server:rootUrl"));
                let jsonData = JSON.parse(data);
                //add additional information if available
                if (jsonData.general != null && jsonData.general.expectedRuntime == null) {
                    jsonData.general.expectedRuntime = Statistics.getMeanExecutionTime(req.originalUrl);
                }
                if (jsonData.general != null && jsonData.general.executions == null) {
                    jsonData.general.executions = Statistics.getNumberOfExecutions(req.originalUrl);
                }
                resolve(jsonData);
            } catch (error) {
                let algo = AlgorithmManagement.getStatusByRoute(req.originalUrl);
                if (algo != null) {
                    error = GetHandler.createError(algo.status.statusCode, algo.status.statusMessage);
                } else {
                    error = GetHandler.createError(404, "This algorithm is not available");
                }
                reject(error);
                return;
            }
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
        return new DivaError(message, status, "RequestError");
    }
}