"use strict";
/**
 * Created by lunactic on 07.11.16.
 */
import * as _ from "lodash";
import * as async from "async";
import * as childProcess from "child_process";
import {EventEmitter} from "events";
import * as express from "express";
import * as nconf from "nconf";
import {Logger} from "../logging/logger";
import {Collection} from "../processingQueue/collection";
import {ConsoleResultHandler} from "./resultHandlers/consoleResultHandler";
import {DockerManagement} from "../docker/dockerManagement";
import {FileResultHandler} from "./resultHandlers/fileResultHandler";
import {ImageHelper} from "./imageHelper";
import {IoHelper} from "./ioHelper";
import {NoResultHandler} from "./resultHandlers/noResultHandler";
import * as path from "path";
import {Process} from "../processingQueue/process";
import {ParameterHelper} from "./parameterHelper";
import {RemoteExecution} from "../remoteExecution/remoteExecution";
import {ResultHelper} from "./resultHelper";
import {ServicesInfoHelper} from "./servicesInfoHelper";
import {Statistics} from "../statistics/statistics";
import {ProcessingQueue} from "../processingQueue/processingQueue";
import IResultHandler = require("./resultHandlers/iResultHandler");


export class ExecutableHelper extends EventEmitter {

    remoteExecution: RemoteExecution;

    constructor() {
        super();
        this.remoteExecution = new RemoteExecution(nconf.get("remoteServer:ip"), nconf.get("remoteServer:user"));
    }

    /**
     * Builds the command line executable command
     * @param executablePath The path to the executable
     * @param programType The type of the program
     * @param params The parameters of the executable
     */
    private buildCommand(process: Process): string {
        let execType = this.getExecutionType(process.executableType);

        let paramsPath = "";

        for (let param of _.values(process.parameters.params)) {
            paramsPath += "'" + param + "'";
        }
        return execType + " " + process.executablePath + " " + paramsPath;
    }

    /**
     * Build the remote command for eecution on a qsub cluster
     * @param process
     */
    private buildRemoteCommand(process: Process): string {
        let params = _.clone(process.parameters.params);
        _.forIn(params, function (value: any, key: any) {
            switch (key) {
                case "inputImage", "outputImage", "resultFile":
                    let extension = path.extname(value);
                    let filename = path.basename(value, extension);
                    params[key] = process.rootFolder + path.sep + filename + extension;
                    break;
                case "outputFolder":
                    params[key] = process.rootFolder + path.sep;
                    break;
            }
        });

        _.forOwn(_.intersection(_.keys(params), _.keys(nconf.get("remotePaths"))), function (value: any, key: any) {
            params[value] = nconf.get("remotePaths:" + value);
        });

        let paramsPath = _.values(params).join(" ");
        return "qsub -o " + process.rootFolder + " -e " + process.rootFolder + " " + process.executablePath + " " + paramsPath;
    }

    /**
     * executes a command using the [childProcess](https://nodejs.org/api/child_process.html) module
     * @param command the command to execute
     * @param process the process
     * @param callback the callback function
     */
    private executeCommand(command: string, process: Process, callback: Function): void {
        let exec = childProcess.exec;
        Logger.log("info", "Execute command: " + command, "ExecutableHelper");
        exec(command, {maxBuffer: 1024 * 48828}, function (error: any, stdout: any, stderr: any) {
            Statistics.endRecording(process.id, process.req.originalUrl);
            process.resultHandler.handleResult(error, stdout, stderr, process, callback);
        });
    }

    public executeLocalRequest(process: Process): void {
        let self = this;
        async.waterfall([
            function (callback: Function) {
                process.id = Statistics.startRecording(process);
                let command = self.buildCommand(process);
                if (process.resultType === "console") {
                    command += " 1>" + process.tmpResultFile + ";mv " + process.tmpResultFile + " " + process.resultFile;
                }
                self.executeCommand(command, process, callback);
            }
        ], function (error: any, results: any) {
            self.emit("processingFinished");
        });
    }

    public executeRemoteRequest(process: Process): void {
        let self = this;
        async.waterfall([
            function (callback: Function) {
                self.remoteExecution.uploadFile(process.image.path, process.rootFolder, callback);
            },
            function (callback: Function) {
                let command = self.buildCommand(process);
                process.id = Statistics.startRecording(process);
                command += " " + process.id + " " + process.rootFolder + " > /dev/null";
                self.remoteExecution.executeCommand(command, callback);
            }
        ], function (error: any) {
            if (error != null) {
                Logger.log("error", error, "ExecutableHelper");
            }
        });
    }

    public static executeDockerRequest(process: Process, callback: Function): void {
        process.id = Statistics.startRecording(process);
        process.remoteResultUrl = "http://" + nconf.get("docker:reportHost") + "/jobs/" + process.id;
        process.remoteErrorUrl = "http://" + nconf.get("docker:reportHost") + "/algorithms/" + process.algorithmIdentifier + "/exceptions/" + process.id;
        let serviceInfo = ServicesInfoHelper.getInfoByPath(process.req.originalUrl);
        DockerManagement.runDockerImage(process, serviceInfo.image_name, callback);
    }

    public preprocess(req: any, processingQueue: ProcessingQueue, executionType: string, requestCallback: Function, queueCallback: Function): void {
        let serviceInfo = ServicesInfoHelper.getInfoByPath(req.originalUrl);
        let collection = new Collection();
        collection.method = serviceInfo.service;
        let self = this;
        async.waterfall([
            function (callback: Function) {
                //STEP 1
                let outputFolder = "";
                if (ServicesInfoHelper.methodRequireFiles(serviceInfo)) {
                    if (req.body.images != null && req.body.images[0].type === "collection") {
                        //run it on the whole collection
                        collection.name = req.body.images[0].value;
                        outputFolder = IoHelper.getOutputFolderForImages(collection.name, serviceInfo, serviceInfo.uniqueOnCollection);
                        collection.hasImages = true;
                    } else if (req.body.images != null && req.body.images[0].type === "image") {
                        //run it on a single image
                        collection.name = ImageHelper.getImageInfo(req.body.images[0].value).collection;
                        outputFolder = IoHelper.getOutputFolderForImages(collection.name, serviceInfo, serviceInfo.uniqueOnCollection);
                        collection.hasImages = true;
                    } else {
                        let err = {
                            statusCode: 500,
                            statusText: "This input type is not supported. The only supported type is collection"
                        };
                        Logger.log("error", "Unsupported input type", "ExecutableHelper");
                        callback(err, null);
                    }
                } else if (ServicesInfoHelper.methodRequireData(serviceInfo)) {
                    collection.hasFiles = true;
                    IoHelper.createDataCollectionFolders(serviceInfo);
                    collection.name = serviceInfo.service;
                    outputFolder = IoHelper.getOutputFolderForData(serviceInfo, serviceInfo.uniqueOnCollection);
                } else {
                    IoHelper.createDataCollectionFolders(serviceInfo);
                    collection.name = serviceInfo.service;
                    outputFolder = IoHelper.getOutputFolderForData(serviceInfo, serviceInfo.uniqueOnCollection);
                }
                collection.outputFolder = outputFolder;
                if (req.body.images[0].type === "collection") {
                    self.preprocessCollection(collection, null, req, executionType, callback);
                } else if (req.body.images[0].type === "image") {
                    let hashes: string[] = [req.body.images[0].value];
                    self.preprocessCollection(collection, hashes, req, executionType, callback);
                }
            }, function (collection: Collection, callback: Function) {
                //step 2
                if (collection.result != null) {
                    //preprocess the unprocessed images
                    //TODO get max number
                    let processNumber: number = collection.result.results.length;
                    let md5ToRemove = [];
                    for (let process of collection.processes) {
                        let result = _.filter(collection.result.results, function (item: any) {
                            return item.md5 === process.image.md5;
                        });
                        if (result.length === 0) {
                            self.preprocessImage(process, collection, req, serviceInfo, processNumber);
                            processNumber = processNumber + 1;
                        } else {
                            md5ToRemove.push(process.image.md5);
                        }
                    }
                    _.remove(collection.processes, function (item: any) {
                        return md5ToRemove.indexOf(item.image.md5) > -1;
                    });
                    callback(null, collection);
                } else {
                    let processNumber: number = 0;
                    collection.resultFile = collection.outputFolder + path.sep + "result.json";
                    for (let process of collection.processes) {
                        self.preprocessImage(process, collection, req, serviceInfo, processNumber);
                        processNumber = processNumber + 1;
                    }
                    callback(null, collection);
                }
            },
            function (collection: Collection, callback: Function) {
                //Step 3
                if (collection.result == null) {
                    for (let process of collection.processes) {
                        if (!(process.result != null)) {
                            ParameterHelper.saveParamInfo(process);
                            IoHelper.saveFile(process.resultFile, {status: "planned"}, "utf8", null);
                        }
                    }
                } else {
                    //produce only the results for the unprocessed images
                    for (let process of collection.processes) {
                        ParameterHelper.saveParamInfo(process);
                        IoHelper.saveFile(process.resultFile, {status: "planned"}, "utf8", null);
                    }
                }
                callback(null, collection);
            }
        ], function (error: any, collection: Collection) {
            //finish
            if (error != null) {
                requestCallback(error, null);
            }
            let results = [];
            if (collection.result != null) {
                //add the new processes to the result files
                if (collection.processes.length > 0) {
                    for (let process of collection.processes) {
                        if (process.resultLink != null) {
                            collection.result.results.push({
                                "md5": process.image.md5,
                                "resultLink": process.resultLink
                            });
                        }
                        if (process.result == null) {
                            processingQueue.addElement(process);
                            queueCallback();
                        }
                    }
                    ResultHelper.saveResult(collection, null);
                    requestCallback(null, collection.result);
                } else {
                    //now new stuff to add, just respond
                    requestCallback(null, collection.result);
                }
            } else {
                for (let process of collection.processes) {
                    if (process.resultLink != null) {
                        results.push({"md5": process.image.md5, "resultLink": process.resultLink});
                    }
                    if (process.result == null) {
                        processingQueue.addElement(process);
                        queueCallback();
                    }
                    let message = {
                        results: results,
                        collection: collection.name,
                        resultLink: collection.buildGetUrl(),
                        status: "done"
                    };
                    collection.result = message;
                    ResultHelper.saveResult(collection, null);
                    requestCallback(null, collection.result);
                }
            }
        });
    }

    private preprocessImage(process: Process, collection: Collection, req: express.Request, serviceInfo: any, processNumber: number): void {

        process.number = processNumber;
        process.algorithmIdentifier = serviceInfo.identifier;
        process.executableType = serviceInfo.executableType;
        process.outputFolder = collection.outputFolder;
        IoHelper.createFolder(process.outputFolder);
        process.inputParameters = _.clone(req.body.inputs);
        process.inputHighlighters = _.clone(req.body.inputs.highlighter);
        process.neededParameters = serviceInfo.parameters;
        process.remotePaths = serviceInfo.remotePaths;
        process.method = collection.method;
        if (process.image != null) {
            process.resultFile = IoHelper.buildResultfilePath(process.outputFolder, process.image.name);
            process.tmpResultFile = IoHelper.buildTempResultfilePath(process.outputFolder, process.image.name);
            process.inputImageUrl = process.image.getImageUrl(process.rootFolder);
        } else {
            process.resultFile = IoHelper.buildResultfilePath(process.outputFolder, process.methodFolder);
            process.tmpResultFile = IoHelper.buildTempResultfilePath(process.outputFolder, process.methodFolder);
        }
        ParameterHelper.matchParams(process, req, function (parameters: any) {
            process.parameters = parameters;
            if (ResultHelper.checkProcessResultAvailable(process)) {
                process.result = ResultHelper.loadResult(process);
            } else {
                process.methodFolder = path.basename(process.outputFolder);
                if (req.body.requireOutputImage != null) {
                    process.requireOutputImage = req.body.requireOutputImage;
                }
                process.programType = serviceInfo.programType;
                process.executablePath = serviceInfo.executablePath;
                process.resultType = serviceInfo.output;
                process.resultLink = process.buildGetUrl();
                let resultHandler = null;
                switch (serviceInfo.output) {
                    case "console":
                        resultHandler = new ConsoleResultHandler(process.resultFile);
                        break;
                    case "file":
                        process.parameters.params["resultFile"] = process.resultFile;
                        resultHandler = new FileResultHandler(process.resultFile);
                        break;
                    case "none":
                        resultHandler = new NoResultHandler(process.resultFile);
                        break;
                }
                process.resultHandler = resultHandler;
            }
        });
    }

    private preprocessCollection(collection: Collection, hashes: string[], req: any, executionType: string, callback: Function): void {
        //handle collections with/without images differently
        if (collection.hasImages) {
            if (!(ImageHelper.checkCollectionAvailable(collection.name))) {
                let err = {
                    statusCode: 500,
                    statusText: "The collection " + collection.name + " does not exist on the server",
                    errorType: "CollectionNotAvailable"
                };
                callback(err, null);
            } else {
                collection.inputParameters = _.clone(req.body.inputs);
                this.setCollectionHighlighter(collection, req);
                let images = ImageHelper.loadCollection(collection.name, hashes, false);
                for (let image of images) {
                    let process = new Process();
                    process.req = _.clone(req);
                    process.rootFolder = collection.name;
                    process.type = executionType;
                    process.image = image;
                    process.hasImages = true;
                    collection.processes.push(process);
                }
                if (ResultHelper.checkCollectionResultsAvailable(collection)) {
                    collection.result = ResultHelper.loadResult(collection);
                    callback(null, collection);
                } else {
                    callback(null, collection);
                }
            }
        } else {
            let process = new Process();
            if (collection.hasFiles) {
                process.hasFiles = true;
            }
            collection.inputParameters = _.clone(req.body.inputs);
            this.setCollectionHighlighter(collection, req);
            if (ResultHelper.checkCollectionResultsAvailable(collection)) {
                collection.result = ResultHelper.loadResult(collection);
                process.req = _.clone(req);
                process.rootFolder = collection.name;
                process.type = executionType;
                collection.processes.push(process);
                callback(null, collection);
            } else {
                process.req = _.clone(req);
                process.rootFolder = collection.name;
                process.type = executionType;
                collection.processes.push(process);
                callback(null, collection);
            }
        }
    }

    private getExecutionType(programType: string): string {
        switch (programType) {
            case "java":
                return "java -Djava.awt.headless=true -Xmx4096m -jar";
            case "coffeescript":
                return "coffeescript";
            default:
                return "";
        }
    }

    private setCollectionHighlighter(collection: Collection, req: any): void {
        if (req.body.inputs != null && req.body.inputs.highlighter != null) {
            collection.inputHighlighters = _.clone(req.body.inputs.highlighter);
        } else {
            collection.inputHighlighters = {};
        }
    }

}