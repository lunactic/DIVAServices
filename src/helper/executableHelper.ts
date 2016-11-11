"use strict";
/**
 * Created by lunactic on 07.11.16.
 */
import * as _ from "lodash";
import * as async from "async";
import * as childProcess from "child_process";
import {EventEmitter} from "events";
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
import IResultHandler = require("./resultHandlers/iResultHandler");
import {ProcessingQueue} from "../processingQueue/processingQueue";


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

    public executeDockerRequest(process: Process, callback: Function): void {
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
                        collection.name = req.body.images[0].value;
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
                self.preprocessCollection(collection, req, serviceInfo, executionType, callback);
            }, function (collection: Collection, callback: Function) {
                //step 2
                //immediate callback if collection.result is available
                if (collection.result != null) {
                    callback(null, collection);
                } else {
                    collection.resultFile = collection.outputFolder + path.sep + "result.json";
                    for (let process of collection.processes) {
                        process.algorithmIdentifier = serviceInfo.identifier;
                        process.executableType = serviceInfo.executableType;
                        process.outputFolder = collection.outputFolder;
                        IoHelper.createFolder(process.outputFolder);
                        process.inputParameters = _.clone(req.body.inputs);
                        process.inputHighlighters = _.clone(req.body.inputs.highlighters);
                        process.neededParameters = serviceInfo.parameters;
                        process.remotePaths = serviceInfo.remotePaths;
                        process.method = collection.method;
                        process.parameters = ParameterHelper.matchParams(process, req);
                        if (ResultHelper.checkProcessResultAvailable(process)) {
                            process.result = ResultHelper.loadResult(process);
                        } else {
                            process.methodFolder = path.basename(process.outputFolder);
                            if (process.image != null) {
                                process.resultFile = IoHelper.buildResultfilePath(process.outputFolder, process.image.name);
                                process.tmpResultFile = IoHelper.buildTempResultfilePath(process.outputFolder, process.image.name);
                                process.inputImageUrl = process.image.getImageUrl(process.rootFolder);
                            } else {
                                process.resultFile = IoHelper.buildResultfilePath(process.outputFolder, process.methodFolder);
                                process.tmpResultFile = IoHelper.buildTempResultfilePath(process.outputFolder, process.methodFolder);
                            }
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
                    }
                    callback(null, collection);
                }
            },
            function (collection: Collection, callback: Function) {
                //Step 3
                for (let process of collection.processes) {
                    if (!(process.result != null)) {
                        ParameterHelper.saveParamInfo(process);
                        IoHelper.saveFile(process.tmpResultFile, {status: "planned"}, "utf8", null);
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
                requestCallback(null, collection.result);
            } else {
                for (let process of collection.processes) {
                    if (process.resultLink != null) {
                        results.push({"resultLink": process.resultLink});
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

    private preprocessCollection(collection: Collection, req: any, serviceInof: any, executionType: string, callback: Function): void {
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
                let folder = nconf.get("paths:imageRootPath") + path.sep + collection.name;
                collection.inputParameters = _.clone(req.body.inputs);
                this.setCollectionHighlighter(collection, req);
                if (ResultHelper.checkCollectionResultsAvailable(collection)) {
                    collection.result = ResultHelper.loadResult(collection);
                    callback(null, collection);
                } else {
                    let images = ImageHelper.loadCollection(collection.name, false);
                    for (let image of images) {
                        let process = new Process();
                        process.req = _.clone(req);
                        process.rootFolder = collection.name;
                        process.type = executionType;
                        process.image = image;
                        process.hasImages = true;
                        collection.processes.push(process);
                    }
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