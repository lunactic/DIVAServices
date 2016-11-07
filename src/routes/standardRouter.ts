/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import * as async from "async";
import {IiifManifestParser} from "../parsers/iiifManifestParser";
import * as express from "express";
import {ImageHelper} from "../helper/imageHelper";
import {RandomWordGenerator} from "../randomizer/randomWordGenerator";
import {IoHelper} from "../helper/ioHelper";
import {Logger} from "../logging/logger";
import {Statistics} from "../statistics/statistics";
import {ResultHelper} from "../helper/resultHelper";
import {AlgorithmManagement} from "../management/algorithmManagement";
import {SchemaValidator} from "../validator/schemaValidator";
import md5 = require("md5");
import Image = require("../models/image");

let router = express.Router();

//set up a special route for image uploading
//TODO provide a way to upload other data (currently all sent as req.body.data)
router.post("/upload", function (req: express.Request, res: express.Response) {
    let numOfImages: number = 0;
    async.each(req.body.images, function (image: any, callback: Function) {
        switch (image.type) {
            case "iiif":
                let iiifManifestParser = new IiifManifestParser(image.value);
                iiifManifestParser.initialize().then(function () {
                    //TODO: expand this to all ranges
                    numOfImages += iiifManifestParser.getAllImages(0).length;
                    callback();
                });
                break;
            default:
                numOfImages++;
                callback();
                break;
        }
    }, function (error: any) {
        let imageExists: boolean = false;
        if (numOfImages === 1 && req.body.images.type != "iiif") {
            //check if image exists
            ImageHelper.imageExists(md5(req.body.images[0].value), function (err: any, response: any) {
                if (response.imageAvailable) {
                    send200(res, {collection: response.collection});
                    imageExists = true;
                }
            });
        }
        if (!imageExists) {
            //need to save the image
            let collectionName = RandomWordGenerator.generateRandomWord();
            IoHelper.createImageCollectionFolders(collectionName);
            ImageHelper.createCollectionInformation(collectionName, numOfImages);
            send200(res, {collection: collectionName});
            let process = {
                rootFolder: collectionName
            };
            let imageCounter: number = 1;
            req.body.images.forEach((image: any, index: number) => {
                switch (image.type) {
                    case "iiif":
                        let iiifManifestParser = new IiifManifestParser(image.value);
                        iiifManifestParser.initialize().then(function () {
                            //TODO improve to save all images
                            let images = iiifManifestParser.getAllImages(0);
                            images.forEach((inputImage: any, i: number) => {
                                ImageHelper.saveUrl(inputImage, collectionName, imageCounter, function (image: Image) {
                                    ImageHelper.addImageInfo(image.md5, image.path, collectionName);
                                    ImageHelper.updateCollectionInformation(collectionName, numOfImages, imageCounter++);
                                });
                            });
                        });
                        break;
                    default:
                        ImageHelper.saveBase64(image, collectionName, imageCounter, function (image: Image) {
                            ImageHelper.addImageInfo(image.md5, image.path, collectionName);
                            ImageHelper.updateCollectionInformation(collectionName, numOfImages, imageCounter++);
                        });
                        break;
                }
            });
        }
    });
});

router.post("/jobs/:jobId", function (req: express.Request, res: express.Response) {
    Logger.log("info", "jobs route called", "StandardRouter");
    let process = Statistics.getProcess(req.params.jobId);
    if (process != null) {
        Statistics.endRecording(req.params.jobId, process.req.originalUrl);
        async.waterfall([
            function (callback: Function) {
                process.result = req.body
                ResultHelper.saveResult(process, callback);
            }, function (callback: Function) {
                //TODO: Check the schema here already
                process.resultHandler.handleResult(null, null, null, process, function (error: any, data: any, processId: string) {
                    if (error != null) {
                        callback(error);
                    } else {
                        callback(null);
                    }
                })
            }
        ], function (error: any) {
            if (error != null) {
                AlgorithmManagement.updateStatus(null, "error", process.req.originalUrl, error.statusMessage);
                sendError(res, error);
            } else if (process.type === "test") {
                SchemaValidator.validate(IoHelper.loadFile(process.resultFile), "responseSchema", function (error: any) {
                    if (error != null) {
                        AlgorithmManagement.updateStatus(null, "error", process.req.originalUrl, error.statusText);
                        ResultHelper.removeResult(process);
                        sendError(res, error);
                    } else {
                        AlgorithmManagement.updateStatus(null, "ok", process.req.originalUrl, "");
                        ResultHelper.removeResult(process);
                        send200(res, {status: "valid"});
                    }
                });
            } else {
                res.status(200);
                res.send();
            }
        });
    } else {
        res.status(500);
        res.send();
    }
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