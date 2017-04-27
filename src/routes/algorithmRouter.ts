"use strict";
/**
 * Created by Marcel Würsch on 08.11.16.
 */
import { AlgorithmManagement } from "../management/algorithmManagement";
import { DockerManagement } from "../docker/dockerManagement";
import { Logger } from "../logging/logger";
import * as nconf from "nconf";
import { ResultHelper } from "../helper/resultHelper";
import * as express from "express";
import { SchemaValidator } from "../validator/schemaValidator";
import { ServicesInfoHelper } from "../helper/servicesInfoHelper";
import { Statistics } from "../statistics/statistics";
import { QueueHandler } from "../processingQueue/queueHandler";
import { DivaError } from '../models/divaError';
import { IoHelper } from '../helper/ioHelper';
import * as path from "path";

let router = express.Router();

/**
 * routes are not documented, check the swagger.json file
 */

/**
 * Get the status of an existing parameter
 */
router.get("/algorithms/:identifier", function (req: express.Request, res: express.Response) {
    let identifier = req.params.identifier;
    let status = AlgorithmManagement.getStatusByIdentifier(identifier);
    if (status == null) {
        sendError(res, new DivaError("Algorithm with identifier " + identifier + " not available", 404, "MethodNotAvailable"));
    } else {
        send200(res, status);
    }
});

/**
 * Create a new algorithm
 */
router.post("/algorithms", async function (req: express.Request, res: express.Response) {
    //add a new algorithm
    //1) validate the incoming request
    try {
        await SchemaValidator.validate(req.body, "createSchema");
        let baseroute = AlgorithmManagement.generateBaseRoute(req.body);
        let version = AlgorithmManagement.getVersionByBaseRoute("/" + baseroute);
        let route = baseroute + "/" + version;
        //check if we have this route already
        let status = AlgorithmManagement.getStatusByRoute("/" + baseroute);
        let imageName = AlgorithmManagement.generateImageName(req.body, version);
        //2) generate route
        if (status != null) {
            switch (status.status.statusCode) {
                case 200:
                    sendError(res, new DivaError("An algorithm with the same name / type combination already exists. Please change the name of the algorithm", 500, "MethodDuplication"));
                    break;
                case 410:
                    //algorithm was deleted, create a new one
                    IoHelper.deleteFolder(nconf.get("paths:executablePath") + path.sep + route);
                    let identifier = AlgorithmManagement.createIdentifier();
                    try {
                        AlgorithmManagement.generateFolders(route);
                        AlgorithmManagement.removeFromRootInfoFile("/" + route);
                        AlgorithmManagement.removeFromServiceInfoFile("/" + baseroute);
                        let response = await AlgorithmManagement.createAlgorithm(req, res, route, identifier, imageName, version, baseroute);
                        sendWithStatus(res, response);
                    } catch (error) {
                        sendError(res, error);
                    }
                    break;
                case 500:
                    //currently in error. Delete the current image and create a new one
                    IoHelper.deleteFolder(nconf.get("paths:executablePath") + path.sep + route);
                    AlgorithmManagement.generateFolders(route);
                    AlgorithmManagement.removeFromRootInfoFile("/" + route);
                    AlgorithmManagement.removeFromServiceInfoFile("/" + baseroute);
                    try {
                        //await DockerManagement.removeImage(status.image_name);
                        let identifier = AlgorithmManagement.createIdentifier();
                        //AlgorithmManagement.updateIdentifier("/" + route, identifier);
                        let response = await AlgorithmManagement.createAlgorithm(req, res, route, identifier, imageName, version, baseroute);
                        sendWithStatus(res, response);

                    } catch (error) {
                        sendError(res, error);
                    }

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
            try {
                let response = await AlgorithmManagement.createAlgorithm(req, res, route, identifier, imageName, version, baseroute);
                sendWithStatus(res, response);
            } catch (error) {
                Logger.log("error", error.message, "AlgorithmRouter");
                sendError(res, error);
            }
        }
    } catch (error) {
        Logger.log("error", error.message, "AlgorithmRouter");
        sendError(res, error);
    }
});

/**
 * update an existing algorithm
 */
router.put("/algorithms/:identifier", async function (req: express.Request, res: express.Response) {
    //perform a deletion and an addition of the new algorithm
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
        try {
            await DockerManagement.removeImage(serviceInfo.image_name);
            await SchemaValidator.validate(req.body, "createSchema");
            let identifier = AlgorithmManagement.createIdentifier();
            let imageName = AlgorithmManagement.generateImageName(req.body, version);
            let response = await AlgorithmManagement.createAlgorithm(req, res, newRoute, identifier, imageName, version, baseroute);
            sendWithStatus(res, response);
        } catch (error) {
            sendError(res, error);
        }

    } else {
        sendError(res, new DivaError("No algorithm with identifier " + req.params.identifier + " found", 404, "AlgorithmNotFound"));
    }
});

/**
 * Record an exception for an existing algorithm
 */
router.post("/algorithms/:identifier/exceptions/:jobId", function (req: express.Request, res: express.Response) {
    AlgorithmManagement.recordException(req.params.identifier, req["text"]);
    //TODO rethink this process
    let process = QueueHandler.getDockerJob(req.params.jobId);
    if (process.type === "test") {
        AlgorithmManagement.updateStatus(process.algorithmIdentifier, "error", process.req.originalUrl, req["text"]);
        ResultHelper.removeResult(process);
    } else {
        Statistics.endRecording(req.params.jobId, process.req.originalUrl, [0, 0]);
        process.resultHandler.handleError("error running the algorithm", process);
    }
    send200(res, {});
});

/**
 * delete an existing algorithm
 */
router.delete("/algorithms/:identifier", async function (req: express.Request, res: express.Response) {
    //set algorithm status to deleted
    let serviceInfo = ServicesInfoHelper.getInfoByIdentifier(req.params.identifier);
    AlgorithmManagement.updateStatus(req.params.identifier, "delete", null, null);
    //remove /route/info.json file
    AlgorithmManagement.deleteInfoFile(nconf.get("paths:jsonPath") + serviceInfo.path);
    AlgorithmManagement.removeFromRootInfoFile(serviceInfo.path);
    try {
        await DockerManagement.removeImage(serviceInfo.image_name);
    } catch (error) {
        res.status(200).send();
        Logger.log("info", "deleted algorithm " + req.params.identifier, "AlgorithmRouter");
    }
});

/**
 * get all recorded exceptions of an algorithm
 */
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

function sendError(res: express.Response, error: DivaError) {
    res.status(error.statusCode || 500);
    res.json(error);
}

export = router;