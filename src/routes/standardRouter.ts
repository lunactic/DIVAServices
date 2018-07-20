import * as express from 'express';
import * as _ from 'lodash';
import * as mime from 'mime';
import * as multer from 'multer';
import * as nconf from 'nconf';
import * as path from 'path';
import { isNullOrUndefined } from "util";
import { FileHelper } from "../helper/fileHelper";
import { IoHelper } from "../helper/ioHelper";
import { Logger } from "../logging/logger";
import { DivaError } from '../models/divaError';
import { DivaFile } from "../models/divaFile";
import { IiifManifestParser } from "../parsers/iiifManifestParser";
import { QueueHandler } from '../processingQueue/queueHandler';
import { RandomWordGenerator } from "../randomizer/randomWordGenerator";
import { SchemaValidator } from "../validator/schemaValidator";
import { GetHandler } from "./getHandler";
import { PostHandler } from "./postHandler";

/**
 * Created by Marcel Würsch on 02.11.16.
 */
"use strict";


var upload = multer({ dest: nconf.get("paths:filesPath") });

let router = express.Router();

/**
 * upload data to the server
 */
router.post("/collections", async function (req: express.Request, res: express.Response) {
    let numOfFiles: number = 0;
    let collectionName = "";
    if (_.has(req.body, "name")) {
        if (req.body.name.length === 0) {
            sendError(res, new DivaError("Empty collection name provided!", 500, "Empty collection name"));
            return;
        } else if (FileHelper.checkCollectionAvailable(req.body.name)) {
            sendError(res, new DivaError("A collection with the name: " + req.body.name + " already exists.", 500, "DuplicateCollectionError"));
            return;
        } else {
            collectionName = req.body.name;
        }
    } else {
        collectionName = RandomWordGenerator.generateRandomWord();
    }

    //count the total number of files
    for (let file of req.body.files) {
        switch (file.type) {
            case "iiif":
                let iiifManifestParser = new IiifManifestParser(file.value);
                await iiifManifestParser.initialize();
                numOfFiles += iiifManifestParser.getAllImages(0).length;
                break;
            case "url":
                numOfFiles++;
                break;
            default:
                if (!isNullOrUndefined(file.name)) {
                    if (!IoHelper.isValidFileName(file.name)) {
                        sendError(res, new DivaError("One of your files has a file name with a special character", 500, "FileNameError"));
                        return;
                    }
                }
                numOfFiles++;
                break;
        }
    }
    //create folders and info file
    await IoHelper.createFilesCollectionFolders(collectionName);
    FileHelper.createCollectionInformation(collectionName, numOfFiles);
    send200(res, { collection: collectionName });
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
                        var image = await FileHelper.saveFileUrl(inputImage, collectionName + path.sep, file.name);
                        FileHelper.addFileInfo(image.path, collectionName);
                        FileHelper.updateCollectionInformation(collectionName, numOfFiles, ++imageCounter);
                    } catch (error) {
                        //TODO add error info into the collection information
                        Logger.log("error", "error downloading image with message: " + error, "StandardRouter");
                    }
                }
                break;
            case "url":
                try {
                    let url: string = file.value;
                    if (mime.getType(url) === "application/zip") {
                        FileHelper.saveZipUrl(file.value, collectionName);
                    } else {
                        var newFile: DivaFile = await FileHelper.saveFileUrl(file.value, collectionName, file.name);
                        await FileHelper.addFileInfo(newFile.path, collectionName);
                        await FileHelper.updateCollectionInformation(collectionName, numOfFiles, ++imageCounter);
                    }
                } catch (error) {
                    //TODO add error info into the collection information
                    Logger.log("error", "error downloading image from url: " + file.value + " with message: " + error, "StandardRouter");
                }
                break;
            case "text":
                var newFile: DivaFile = await FileHelper.saveFileText(file.value, collectionName, file.name);
                await FileHelper.addFileInfo(newFile.path, collectionName);
                await FileHelper.updateCollectionInformation(collectionName, numOfFiles, ++imageCounter);
                break;
            default:
                try {
                    var newFile: DivaFile = await FileHelper.saveBase64(file, collectionName);
                    await FileHelper.addFileInfo(newFile.path, collectionName);
                    await FileHelper.updateCollectionInformation(collectionName, numOfFiles, ++imageCounter);
                    break;
                } catch (error) {
                    //TODO add error info into the collection information
                    Logger.log("error", "error saving image from base64", "StandardRouter");
                }
        }
    }
});

router.put("/collections/:collectionName", async function (req: express.Request, res: express.Response) {
    let collectionName = req.params["collectionName"];
    let numOfFiles: number = 0;
    let counter: number = 0;
    if (FileHelper.checkCollectionAvailable(collectionName)) {
        //count the total number of images
        numOfFiles = FileHelper.loadCollection(collectionName).length;
        let imageCounter: number = numOfFiles;
        for (let file of req.body.files) {
            let fullPath = nconf.get("paths:filesPath") + path.sep + collectionName + path.sep + "original" + path.sep + file.name;
            let fileExists: boolean = false;
            if (await FileHelper.fileExists(fullPath)) {
                fileExists = true;
            }

            switch (file.type) {
                case "iiif":
                    let iiifManifestParser = new IiifManifestParser(file.value);
                    await iiifManifestParser.initialize();
                    numOfFiles += iiifManifestParser.getAllImages(0).length;
                    break;
                case "url":
                    if (!fileExists) {
                        numOfFiles++;
                    }
                    break;
                default:
                    if (!fileExists) {
                        numOfFiles++;
                    }
                    break;
            }
            counter++;
        }
        //update info file
        await FileHelper.addFilesCollectionInformation(collectionName, numOfFiles);

        //download the files
        for (let file of req.body.files) {
            let fullPath = nconf.get("paths:filesPath") + path.sep + collectionName + path.sep + "original" + path.sep + file.name;
            let fileExists: boolean = false;
            if (await FileHelper.fileExists(fullPath)) {
                fileExists = true;
            }

            switch (file.type) {
                case "iiif":
                    let iiifManifestParser = new IiifManifestParser(file.value);
                    await iiifManifestParser.initialize();
                    let images = iiifManifestParser.getAllImages(0);
                    for (let inputImage of images) {
                        try {
                            var image = await FileHelper.saveFileUrl(inputImage, collectionName + path.sep);
                            FileHelper.addFileInfo(image.path, collectionName);
                            FileHelper.updateCollectionInformation(collectionName, numOfFiles, ++imageCounter);
                        } catch (error) {
                            //TODO add error info into the collection information
                            Logger.log("error", "error downloading image with message: " + error, "StandardRouter");
                        }
                    }
                    break;
                case "url":
                    try {
                        let url: string = file.value;
                        if (mime.getType(url) === "application/zip") {
                            await FileHelper.saveZipUrl(file.value, collectionName);
                        } else {
                            var newFile: DivaFile = await FileHelper.saveFileUrl(file.value, collectionName, file.name);
                            if (!fileExists) {
                                await FileHelper.addFileInfo(newFile.path, collectionName);
                                await FileHelper.updateCollectionInformation(collectionName, numOfFiles, ++imageCounter);
                            }
                        }
                    } catch (error) {
                        //TODO add error info into the collection information
                        Logger.log("error", "error downloading image from url: " + file.value + " with message: " + error, "StandardRouter");
                        sendError(res, new DivaError("Error downloading image from url: " + file.value + " with message " + error, 500, "DownloadError"));
                        return;
                    }
                    break;
                case "text":
                    var newFile: DivaFile = await FileHelper.saveFileText(file.value, collectionName, file.name);
                    await FileHelper.addFileInfo(newFile.path, collectionName);
                    await FileHelper.updateCollectionInformation(collectionName, numOfFiles, ++imageCounter);
                    break;
                default:
                    try {
                        var newFile: DivaFile = await FileHelper.saveBase64(file, collectionName);
                        await FileHelper.addFileInfo(newFile.path, collectionName);
                        await FileHelper.updateCollectionInformation(collectionName, numOfFiles, ++imageCounter);
                        break;
                    } catch (error) {
                        //TODO add error info into the collection information
                        Logger.log("error", "error saving image from base64", "StandardRouter");
                    }
            }
        }
        send200(res, { status: 200 });
    } else {
        sendError(res, new DivaError("A collection with the name: " + req.params["collectionName"] + " does not exist.", 500, "CollectionNotExistingError"));
    }

});


/**
 * upload a file using form-multipart
 */
router.post("/upload", upload.single('file'), async function (req: express.Request, res: express.Response) {
    try {
        let collectionName = "";
        if (!isNullOrUndefined(req.body.name)) {
            collectionName = req.body.name;
            if (FileHelper.checkCollectionAvailable(req.body.name)) {
                sendError(res, new DivaError("A collection with the name: " + req.body.name + " already exists.", 500, "DuplicateCollectionError"));
                return;
            }
        } else {
            collectionName = RandomWordGenerator.generateRandomWord();
        }
        await IoHelper.createFilesCollectionFolders(collectionName);
        FileHelper.createCollectionInformation(collectionName, 1);
        await IoHelper.moveFile(req.file.path, nconf.get("paths:filesPath") + path.sep + collectionName + path.sep + "original" + path.sep + req.file.originalname);
        let file = DivaFile.CreateFileFullTest(nconf.get("paths:filesPath") + path.sep + collectionName + path.sep + "original" + path.sep + req.file.originalname);
        await FileHelper.addFileInfo(file.path, collectionName);
        await FileHelper.updateCollectionInformation(collectionName, 1, 1);
        send200(res, { collection: collectionName });
    } catch (error) {
        sendError(res, error);
    }

});

/**
 * add a file to a collection using form-multipart data
  */
router.put("/upload/:collectionName", upload.single('file'), async function (req: express.Request, res: express.Response) {
    try {
        if (FileHelper.checkCollectionAvailable(req.params.collectionName)) {
            let currentFiles = FileHelper.loadCollection(req.params.collectionName);
            let numOfFiles: number = currentFiles.length + 1;
            if (await FileHelper.fileExists(nconf.get("paths:filesPath") + path.sep + req.params.collectionName + path.sep + "original" + path.sep + req.file.originalname)) {
                sendError(res, new DivaError("File with the name: " + req.file.originalname + " exists already in collection: " + req.params.collectionName, 500, "DuplicateFileError"));
            } else {
                await IoHelper.moveFile(req.file.path, nconf.get("paths:filesPath") + path.sep + req.params.collectionName + path.sep + "original" + path.sep + req.file.originalname);
                let file = DivaFile.CreateFileFullTest(nconf.get("paths:filesPath") + path.sep + req.params.collectionName + path.sep + "original" + path.sep + req.file.originalname);
                await FileHelper.addFileInfo(file.path, req.params.collectionName);
                await FileHelper.updateCollectionInformation(req.params.collectionName, numOfFiles, numOfFiles);
                res.status(200).send();
            }
        } else {
            sendError(res, new DivaError("A collection with the name: " + req.params["collectionName"] + " does not exist.", 500, "CollectionNotExistingError"));
        }
    } catch (error) {
        sendError(res, error);
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
    if (unlike(req, "/algorithm") && unlike(req, "/mgmt")) {
        try {
            let response = await PostHandler.handleRequest(req);
            response["statusCode"] = 202;
            send200(res, response);
            QueueHandler.executeDockerRequest();
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
        collectionInfo.push({
            "collection": {
                name: collection,
                url: 'http://' + nconf.get("server:rootUrl") + "/collections" + "/" + collection
            }
        });
    }
    let response = {
        collections: collectionInfo
    };
    send200(res, response);
});

/** 
 * get files from a collection
 */
router.get("/collections/:collection", function (req: express.Request, res: express.Response) {
    let collection = req.params.collection;
    if (FileHelper.checkCollectionAvailable(collection)) {
        let status = FileHelper.getCollectionInformation(collection);
        let files = FileHelper.loadCollection(collection);
        let response = [];
        for (let file of files) {
            response.push({
                "file": {
                    url: file.url,
                    identifier: file.identifier,
                    options: file.options
                }
            });
        }
        status['files'] = response;
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

router.get("/collections/:collection/zip", async function (req: express.Request, res: express.Response) {
    let collection = req.params.collection;
    let filename = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "data.zip";
    if (await FileHelper.fileExists(filename)) {
        res.download(filename);
    } else {
        await IoHelper.zipFolder(nconf.get("paths:filesPath") + path.sep + collection, "data.zip");
        res.download(filename);
    }
});

router.delete("/collections/:collection", function (req: express.Request, res: express.Response) {
    let collection = req.params.collection;
    try {
        FileHelper.deleteCollection(collection);
        res.status(200).send();
    } catch (error) {
        sendResponse(res, error, null);
    }
});

router.delete("/collections/:collection/:name", async function (req: express.Request, res: express.Response) {
    let collection = req.params.collection;
    let name = req.params.name;

    try {
        await FileHelper.deleteFileInCollection(collection, name);
        res.status(200).send();
    } catch (error) {
        sendError(res, error);
    }
});

//info routes
router.get("/information/general", function (req: express.Request, res: express.Response) {
    let general = IoHelper.readFile("conf/algorithmGeneral.json");
    sendResponse(res, null, general);
});

router.get("/information/input", function (req: express.Request, res: express.Response) {
    let input = IoHelper.readFile("conf/algorithmInput.json");
    sendResponse(res, null, input);
});

router.get("/information/output", function (req: express.Request, res: express.Response) {
    let output = IoHelper.readFile("conf/algorithmOutput.json");
    sendResponse(res, null, output);
});

router.get("/information/method", function (req: express.Request, res: express.Response) {
    let method = IoHelper.readFile("conf/algorithmMethod.json");
    sendResponse(res, null, method);
});

//schema routes
router.get("/schemas/create", function (req: express.Request, res: express.Response) {
    let create = IoHelper.readFile("conf/schemas/createAlgorithmSchema.json");
    sendResponse(res, null, create);
});

router.get("/schemas/details", function (req: express.Request, res: express.Response) {
    let details = IoHelper.readFile("conf/schemas/detailsAlgorithmSchema.json");
    sendResponse(res, null, details);
});

router.get("/schemas/general", function (req: express.Request, res: express.Response) {
    let general = IoHelper.readFile("conf/schemas/generalAlgorithmSchema.json");
    sendResponse(res, null, general);
});

router.get("/openapi", function (req: express.Request, res: express.Response) {
    let swagger = IoHelper.readFile(nconf.get("paths:swaggerFile"));
    swagger = JSON.parse(JSON.stringify(swagger).replace(new RegExp("\\$BASEURL\\$", "g"), nconf.get("server:rootUrl")));
    sendResponse(res, null, swagger);
});

router.get("*", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    if (unlike(req, "/algorithms") && unlike(req, "/mgmt")) {
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
        let resp = JSON.parse(response);
        res.json(resp);
    } catch (error) {
        res.json(response);
    }
}

function sendWithStatus(res: express.Response, response: any) {
    res.status(res.statusCode || 200);
    try {
        let resp = JSON.parse(response);
        res.json(resp);
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