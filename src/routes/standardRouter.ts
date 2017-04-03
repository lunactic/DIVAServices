import { DivaError } from '../models/divaError';
/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import { IiifManifestParser } from "../parsers/iiifManifestParser";
import * as express from "express";
import { FileHelper } from "../helper/fileHelper";
import { RandomWordGenerator } from "../randomizer/randomWordGenerator";
import { IoHelper } from "../helper/ioHelper";
import { Logger } from "../logging/logger";
import * as nconf from "nconf";
import * as path from "path";
import { Statistics } from "../statistics/statistics";
import { ResultHelper } from "../helper/resultHelper";
import { AlgorithmManagement } from "../management/algorithmManagement";
import { SchemaValidator } from "../validator/schemaValidator";
import { File } from "../models/file";
import { PostHandler } from "./postHandler";
import { GetHandler } from "./getHandler";

let router = express.Router();

/**
 * upload data to the server
 */
router.post("/upload", async function (req: express.Request, res: express.Response) {
    let numOfImages: number = 0;
    let counter: number = 0;

    let collectionName = RandomWordGenerator.generateRandomWord();
    send200(res, { collection: collectionName });

    //count the total number of images
    for (let file of req.body.files) {
        switch (file.type) {
            case "iiif":
                let iiifManifestParser = new IiifManifestParser(file.value);
                await iiifManifestParser.initialize();
                numOfImages += iiifManifestParser.getAllImages(0).length;
                break;
            case "url":
                numOfImages++;
                break;
            default:
                numOfImages++;
                break;
        }
        counter++;
    }
    //create folders and info file
    IoHelper.createFilesCollectionFolders(collectionName);
    FileHelper.createCollectionInformation(collectionName, numOfImages);

    let imageCounter: number = 0;
    //download the files
    for (let file of req.body.files) {
        switch (file.type) {
            case "iiif":
                let iiifManifestParser = new IiifManifestParser(file.value);
                await iiifManifestParser.initialize();
                let images = iiifManifestParser.getAllImages(0);
                for (let inputImage of images) {
                    try {
                        var image = await FileHelper.saveUrl(inputImage, collectionName + path.sep, imageCounter);
                        FileHelper.addFileInfo(image.md5, image.path, collectionName);
                        FileHelper.updateCollectionInformation(collectionName, numOfImages, ++imageCounter);
                    } catch (error) {
                        //TODO add error info into the collection information
                        Logger.log("error", "error downloading image with message: " + error, "StandardRouter");
                    }
                }
                break;
            case "url":
                try {
                    var newFile: File = await FileHelper.saveUrl(file.value, collectionName, imageCounter, file.name);
                    FileHelper.addFileInfo(newFile.md5, newFile.path, collectionName);
                    FileHelper.updateCollectionInformation(collectionName, numOfImages, ++imageCounter);
                } catch (error) {
                    //TODO add error info into the collection information
                    Logger.log("error", "error downloading image from url: " + file.value + " with message: " + error, "StandardRouter");
                }
                break;
            default:
                try {
                    var newFile: File = await FileHelper.saveBase64(file, collectionName, imageCounter);
                    FileHelper.addFileInfo(newFile.md5, newFile.path, collectionName);
                    FileHelper.updateCollectionInformation(collectionName, numOfImages, ++imageCounter);
                    break;
                } catch (error) {
                    //TODO add error info into the collection information
                    Logger.log("error", "error saving image from base64", "StandardRouter");
                }
        }
    }
});

/**
 * method reports a result
 */
router.post("/jobs/:jobId", async function (req: express.Request, res: express.Response) {
    Logger.log("info", "jobs route called", "StandardRouter");
    let process = Statistics.getProcess(req.params.jobId);
    if (process != null) {
        Statistics.endRecording(req.params.jobId, process.req.originalUrl);
        process.result = req.body;
        try {
            await ResultHelper.saveResult(process);
            await process.resultHandler.handleResult(null, null, null, process);
            if (process.type === "test") {
                try {
                    await SchemaValidator.validate(await IoHelper.openFile(process.resultFile), "responseSchema");
                    AlgorithmManagement.updateStatus(null, "ok", process.req.originalUrl, "");
                    await ResultHelper.removeResult(process);
                    res.status(200).end();
                } catch (error) {
                    AlgorithmManagement.updateStatus(null, "error", process.req.originalUrl, error.statusText);
                    await ResultHelper.removeResult(process);
                    sendError(res, error);
                }
            } else {
                res.status(200).end();
            }
        } catch (error) {
            sendError(res, error);
        }
    } else {
        res.status(500).end();
    }
});

/**
 * schema validation
 */
router.post("/validate/:schema", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
        let response;
        switch (req.params.schema) {
            case "host":
                response = await validate(req, "hostSchema");
                break;
            case "hostAlgorithm":
                response = await validate(req, "algorithmSchema");
                break;
            case "response":
                response = await validate(req, "responseSchema");
                break;
            case "detailsAlgorithm":
                response = await validate(req, "detailsAlgorithmSchema");
                break;
            case "create":
                response = await validate(req, "createSchema");
                break;
        }
        send200(res, response);
    } catch (error) {
        sendError(res, error);
    }

});

/**
 * method handler
 */
router.post("*", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    if (unlike(req, "/algorithm")) {
        try {
            let response = await PostHandler.handleRequest(req);
            response["statusCode"] = 202;
            send200(res, response);
        } catch (error) {
            sendError(res, error);
        }
    } else {
        next();
    }
});

/** 
 * get all existing collection
 */
router.get("/collections/", function (req: express.Request, res: express.Response) {
    let collections = FileHelper.getAllCollections();
    let collectionInfo = [];
    for (let collection of collections) {
        if (collection !== "test") {
            collectionInfo.push({
                "collection": {
                    name: collection,
                    url: 'http://' + nconf.get("server:rootUrl") + "/collections" + "/" + collection
                }
            });
        }
    }
    let response = {
        collections: collectionInfo
    };
    send200(res, response);
});

/** 
 * get images from a collection
 */
router.get("/collections/:collection", function (req: express.Request, res: express.Response) {
    let collection = req.params.collection;
    if (FileHelper.checkCollectionAvailable(collection)) {
        let status = FileHelper.getCollectionInformation(collection);
        let files = FileHelper.loadCollection(collection, null);
        let response = [];
        for (let file of files) {
            response.push({
                "image": {
                    md5: file.md5,
                    url: file.url
                }
            });
        }
        status['images'] = response;
        send200(res, status);
    } else {
        let error = {
            statusCode: 404,
            statusText: "This collection is not available",
            errorType: "CollectionNotAvailable"
        };
        sendResponse(res, error, null);
    }
});

router.get("/images/:md5/check", async function (req: express.Request, res: express.Response) {
    try {
        var response = await FileHelper.fileExists(req.params.md5);
        sendResponse(res, null, response);
    } catch (error) {
        sendResponse(res, error, null);
    }
});

//info routes
router.get("/information/general", function (req: express.Request, res: express.Response) {
    let general = IoHelper.openFile("conf/algorithmGeneral.json");
    sendResponse(res, null, general);
});

router.get("/information/input", function (req: express.Request, res: express.Response) {
    let input = IoHelper.openFile("conf/algorithmInput.json");
    sendResponse(res, null, input);
});

router.get("/information/method", function (req: express.Request, res: express.Response) {
    let method = IoHelper.openFile("conf/algorithmMethod.json");
    sendResponse(res, null, method);
});

//schema routes
router.get("/schemas/create", function (req: express.Request, res: express.Response) {
    let create = IoHelper.openFile("conf/schemas/createAlgorithmSchema.json");
    sendResponse(res, null, create);
});

router.get("/schemas/details", function (req: express.Request, res: express.Response) {
    let details = IoHelper.openFile("conf/schemas/detailsAlgorithmSchema.json");
    sendResponse(res, null, details);
});

router.get("/schemas/general", function (req: express.Request, res: express.Response) {
    let general = IoHelper.openFile("conf/schemas/generalAlgorithmSchema.json");
    sendResponse(res, null, general);
});

router.get("/openapi", function (req: express.Request, res: express.Response) {
    let swagger = IoHelper.openFile(nconf.get("paths:swaggerFile"));
    swagger = JSON.parse(JSON.stringify(swagger).replace(new RegExp("\\$BASEURL$\\", "g"), nconf.get("server:rootUrl")));
    sendResponse(res, null, swagger);
});

router.get("*", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    if (unlike(req, "/algorithms")) {
        try {
            var response = await GetHandler.handleRequest(req);
            sendResponse(res, null, response);
        } catch (error) {
            sendResponse(res, error, null);
        }
    } else {
        next();
    }
});

async function validate(req: express.Request, schema: string) {
    try {
        await SchemaValidator.validate(req.body, schema);
        Promise.resolve({ status: "valid" });
    } catch (error) {
        Promise.reject(error);
    }
}

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
    res.json({ message: error.message, errorType: error.errorType });
}

function unlike(req: express.Request, path: string) {
    if (req.path.search(path) >= 0) {
        return false;
    } else {
        return true;
    }
}


export = router;