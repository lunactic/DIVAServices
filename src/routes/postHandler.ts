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
     * @param {Function} callback the callback function
     * 
     * @memberOf PostHandler
     */
    static handleRequest(req: any, callback: Function): void {
        let serviceInfo = ServicesInfoHelper.getInfoByPath(req.originalUrl);

        if (serviceInfo == null) {
        //if no matching method for the route, return a 404
            let error = {
                statusCode: 404,
                statusText: "This method is not available",
                errorType: "MethodNotAvailable"
            };
            callback(error, null);
        } else if (serviceInfo.status.statusCode === 410) {
            //if method was removed, return a 410    
            let error = {
                statusCode: 410,
                statusText: "This algorithm is no longer available",
                errorType: "MethodNoLongerAvailable"
            };
            callback(error, null);
        } else {
            //method found, prepare and execute process
            switch (serviceInfo.execute) {
                case "remote":
                    QueueHandler.addRemoteRequest(req, callback);
                    break;
                case "local":
                    QueueHandler.addLocalRequest(req, callback);
                    break;
                case "docker":
                    QueueHandler.addDockerRequest(req, callback);
                    break;
                default:
                    Logger.log("error", "Error in definition for method " + req.originalUrl, "PostHandler");
                    let error = {
                        statusCode: 500,
                        statusText: "Error in method definition"
                    };
                    callback(error, null);
                    break;
            }
        }
    }

}