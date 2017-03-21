"use strict";

/**
 * Created by lunactic on 07.11.16.
 */

import { QueueHandler } from "../processingQueue/queueHandler";
import { ServicesInfoHelper } from "../helper/servicesInfoHelper";
import { Logger } from "../logging/logger";

/**
 * class for handling POST requests that don't have a specific route (e.g. all methods)
 * 
 * @export
 * @class PostHandler
 */
export class PostHandler {

    /**
     * request handler
     * 
     * @static
     * @param {*} req the incoming POST request
     * 
     * @memberOf PostHandler
     */
    static async handleRequest(req: any): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            let serviceInfo = ServicesInfoHelper.getInfoByPath(req.originalUrl);

            if (serviceInfo == null) {
                //if no matching method for the route, return a 404
                let error = {
                    statusCode: 404,
                    statusText: "This method is not available",
                    errorType: "MethodNotAvailable"
                };
                reject(error);
            } else if (serviceInfo.status.statusCode === 410) {
                //if method was removed, return a 410    
                let error = {
                    statusCode: 410,
                    statusText: "This algorithm is no longer available",
                    errorType: "MethodNoLongerAvailable"
                };
                reject(error);
            } else {
                //method found, prepare and execute process
                let response: any = null;
                try {
                    switch (serviceInfo.execute) {
                        case "remote":
                            response = await QueueHandler.addRemoteRequest(req);
                            resolve(response);
                            break;
                        case "local":
                            response = await QueueHandler.addLocalRequest(req);
                            resolve(response);
                            break;
                        case "docker":
                            response = await QueueHandler.addDockerRequest(req);
                            resolve(response);
                            break;
                        default:
                            Logger.log("error", "Error in definition for method " + req.originalUrl, "PostHandler");
                            let error = {
                                statusCode: 500,
                                statusText: "Error in method definition"
                            };
                            reject(error);
                            break;
                    }
                } catch (error) {
                    reject(error);
                }
            }
        });
    }

}