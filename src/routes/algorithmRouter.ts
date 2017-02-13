"use strict";
/**
 * Created by lunactic on 08.11.16.
 */


import * as _ from "lodash";
import { AlgorithmManagement } from "../management/algorithmManagement";
import * as async from "async";
import { DockerManagement } from "../docker/dockerManagement";
import { ExecutableHelper } from "../helper/executableHelper";
import * as fs from "fs";
import { IoHelper } from "../helper/ioHelper";
import { Logger } from "../logging/logger";
import * as nconf from "nconf";
import * as path from "path";
import { ResultHelper } from "../helper/resultHelper";
import * as express from "express";
import { SchemaValidator } from "../validator/schemaValidator";
import { ServicesInfoHelper } from "../helper/servicesInfoHelper";
import { Statistics } from "../statistics/statistics";
import { Swagger } from "../swagger/swagger";
import { QueueHandler } from "../processingQueue/queueHandler";

let router = express.Router();

/**
 * routes are not documented, check the swagger.json file
 */

router.get("/algorithms/:identifier", function (req: express.Request, res: express.Response) {
    let identifier = req.params.identifier;
    let status = AlgorithmManagement.getStatusByIdentifier(identifier);
    if (status == null) {
        let error = {
            statusCode: 404,
            statusMessage: "Algorithm with identifier " + identifier + " not available",
            errorType: "MethodNotAvailable"
        };
        sendError(res, error);
    } else {
        send200(res, status);
    }
});

router.post("/algorithms", function (req: express.Request, res: express.Response) {
    //add a new algorithm
    //1) validate the incoming request
    SchemaValidator.validate(req.body, "createSchema", function (error: any) {
        if (error != null) {
            sendError(res, error);
        } else {
            //2) generate route
            let baseroute = AlgorithmManagement.generateBaseRoute(req.body);
            let version = AlgorithmManagement.getVersionByBaseRoute("/" + baseroute);
            let route = baseroute + "/" + version;
            //check if we have this route already
            let status = AlgorithmManagement.getStatusByRoute("/" + baseroute);
            let imageName = AlgorithmManagement.generateImageName(req.body, version);
            if (status != null) {
                switch (status.status.statusCode) {
                    case 200:
                        let err = {
                            statusCode: 500,
                            statusText: "An algorithm with the same name / type combination already exists. Please change the name of the algorithm",
                            errorType: "MethodDuplication"
                        };
                        sendError(res, err);
                        break;
                    case 410:
                        //algorithm was deleted, create a new one
                        let identifier = AlgorithmManagement.createIdentifier();
                        AlgorithmManagement.createAlgorithm(req, res, route, identifier, imageName, version, baseroute, function (error: any, response: any) {
                            if (error != null) {
                                sendError(res, error);
                            } else {
                                sendWithStatus(res, response);
                            }
                        });
                        break;
                    case 500:
                        //currently in error. Delete the current image and create a new one
                        AlgorithmManagement.generateFolders(route);
                        AlgorithmManagement.removeFromRootInfoFile("/" + route);
                        AlgorithmManagement.removeFromServiceInfoFile("/" + route);
                        DockerManagement.removeImage(status.image_name, function (error: any) {
                            if (error == null) {
                                let identifier = AlgorithmManagement.createIdentifier();
                                AlgorithmManagement.updateIdentifier("/" + route, identifier);
                                AlgorithmManagement.createAlgorithm(req, res, route, identifier, imageName, version, baseroute, function (error: any, response: any) {
                                    if (error != null) {
                                        sendError(res, error);
                                    } else {
                                        sendWithStatus(res, response);
                                    }
                                });
                            }
                        });
                        break;
                    default:
                        let response = {
                            statusCode: status.status.statusCode,
                            identifier: status.identifier,
                            statusMessage: status.statusMessage
                        };
                        sendResponse(res, null, response);
                        break;
                }
            } else {
                //create a new algorithm
                let identifier = AlgorithmManagement.createIdentifier();
                AlgorithmManagement.generateFolders(route);
                AlgorithmManagement.createAlgorithm(req, res, route, identifier, imageName, version, baseroute, function (error: any, response: any) {
                    if (error != null) {
                        sendError(res, error);
                    } else {
                        sendWithStatus(res, response);
                    }
                });
            }
        }
    });

});

router.put("/algorithms/:identifier", function (req: express.Request, res: express.Response) {
    //perform a deleteion and an addition of the new algorithm
    let serviceInfo = ServicesInfoHelper.getInfoByIdentifier(req.params.identifier);
    if (serviceInfo != null) {
        let currentRoute = serviceInfo.path;
        let baseroute = serviceInfo.baseroute;
        let routeParts = currentRoute.split("/").filter(function (n: string) {
            return n !== "";
        });
        //increase the number
        routeParts[routeParts.length - 1]++;
        let newRoute = routeParts.join("/");
        let version: number = parseInt(routeParts[routeParts.length - 1]);
        switch (serviceInfo.status.statusCode) {
            case 410:
                //error recovery
                AlgorithmManagement.removeFromServiceInfoFile(newRoute);
                break;
            default:
                AlgorithmManagement.updateStatus(req.params.identifier, "delete", null, null);
                //remove /route/info.json file
                AlgorithmManagement.deleteInfoFile(nconf.get("paths:jsonPath") + serviceInfo.path);
                AlgorithmManagement.removeFromRootInfoFile(serviceInfo.path);
                break;
        }
        DockerManagement.removeImage(serviceInfo.image_name, function (error: any) {
            if (error == null) {
                SchemaValidator.validate(req.body, "createSchema", function (error: any) {
                    if (error != null) {
                        sendError(res, error);
                    } else {
                        let identifier = AlgorithmManagement.createIdentifier();
                        let imageName = AlgorithmManagement.generateImageName(req.body, version);
                        AlgorithmManagement.generateFolders(newRoute);
                        AlgorithmManagement.createAlgorithm(req, res, newRoute, identifier, imageName, version, baseroute, function (error: any, response: any) {
                            if (error != null) {
                                sendError(res, error);
                            } else {
                                sendWithStatus(res, response);
                            }
                        });
                    }
                });
            }
        });
    } else {
        let err = {
            statusCode: 404,
            statusText: "No algorithm with identifier " + req.params.identifier + " found",
            errorType: "AlgorithmNotFound"
        };
        sendError(res, err);
    }
});

router.post("/algorithms/:identifier/exceptions/:jobId", function (req: express.Request, res: express.Response) {
    AlgorithmManagement.recordException(req.params.identifier, req["text"]);
    //TODO rethink this process
    let process = QueueHandler.getDockerJob(req.params.jobId);
    if (process.type === "test") {
        AlgorithmManagement.updateStatus(process.algorithmIdentifier, "error", process.req.originalUrl, req["text"]);
        ResultHelper.removeResult(process);
    } else {
        Statistics.endRecording(req.params.jobId, process.req.originalUrl);
        process.resultHandler.handleError("error running the algorithm", process);
    }
    send200(res, {});
});

router.delete("/algorithms/:identifier", function (req: express.Request, res: express.Response) {
    //set algorithm status to deleted
    let serviceInfo = ServicesInfoHelper.getInfoByIdentifier(req.params.identifier);
    AlgorithmManagement.updateStatus(req.params.identifier, "delete", null, null);
    //remove /route/info.json file
    AlgorithmManagement.deleteInfoFile(nconf.get("paths:jsonPath") + serviceInfo.path);
    AlgorithmManagement.removeFromRootInfoFile(serviceInfo.path);
    DockerManagement.removeImage(serviceInfo.image_name, function (error: any) {
        if (error != null) {
            res.status(200).send();
            Logger.log("info", "deleted algorithm " + req.params.identifier, "AlgorithmRouter");
        }
    });
});

router.get("/algorithms/:identifier/exceptions", function (req: express.Request, res: express.Response) {
    let exceptions = AlgorithmManagement.getExceptions(req.params.identifier);
    send200(res, exceptions);
});

function sendResponse(res: express.Response, error: any, response: any) {
    if (error != null) {
        sendError(res, error);
    } else {
        sendWithStatus(res, response);
    }
}

function send200(res: express.Response, response: any) {
    res.status(200);
    try {
        res.json(JSON.parse(response));
    } catch (error) {
        res.json(response);
    }
}

function sendWithStatus(res: express.Response, response: any) {
    res.status(res.statusCode || 200);
    try {
        res.json(JSON.parse(response));
    } catch (error) {
        res.json(response);
    }
}

function sendError(res: express.Response, error: any) {
    res.status(error.statusCode || 500);
    let err = {
        status: error.statusCode,
        type: error.errorType,
        message: error.statusText
    };
    res.json(err);
}

export = router;