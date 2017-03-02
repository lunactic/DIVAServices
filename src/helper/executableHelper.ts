"use strict";
/**
 * Created by lunactic on 07.11.16.
 */
import * as _ from "lodash";
import * as async from "async";
import * as childProcess from "child_process";
import { EventEmitter } from "events";
import * as express from "express";
import * as nconf from "nconf";
import { Logger } from "../logging/logger";
import { Collection } from "../processingQueue/collection";
import { ConsoleResultHandler } from "./resultHandlers/consoleResultHandler";
import { DockerManagement } from "../docker/dockerManagement";
import { FileResultHandler } from "./resultHandlers/fileResultHandler";
import { ImageHelper } from "./imageHelper";
import { DataHelper } from "./dataHelper";
import { IoHelper } from "./ioHelper";
import { NoResultHandler } from "./resultHandlers/noResultHandler";
import * as path from "path";
import { Process } from "../processingQueue/process";
import { ParameterHelper } from "./parameterHelper";
import { RemoteExecution } from "../remoteExecution/remoteExecution";
import { ResultHelper } from "./resultHelper";
import { ServicesInfoHelper } from "./servicesInfoHelper";
import { Statistics } from "../statistics/statistics";
import { ProcessingQueue } from "../processingQueue/processingQueue";
import { RandomWordGenerator } from "../randomizer/randomWordGenerator";
import IResultHandler = require("./resultHandlers/iResultHandler");


/**
 * A class the provides all functionality needed before a process can be executed
 * 
 * @export
 * @class ExecutableHelper
 * @extends {EventEmitter}
 */
export class ExecutableHelper extends EventEmitter {

    remoteExecution: RemoteExecution;

    /**
     * Creates an instance of ExecutableHelper.
     * 
     * 
     * @memberOf ExecutableHelper
     */
    constructor() {
        super();
        this.remoteExecution = new RemoteExecution(nconf.get("remoteServer:ip"), nconf.get("remoteServer:user"));
    }

    /**
     * Builds the command line executable command
     * @param {Process} process the process to execute
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
     * Build the remote command for execution on a Sun Grid Engine using qsub
     * @param {Process} process The process to execute
     */
    private buildRemoteCommand(process: Process): string {
        let params = _.clone(process.parameters.params);
        _.forIn(params, function (value: any, key: any) {
            switch (key) {
                case "inputImage":
                case "outputImage":
                case "resultFile":
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
     * @param {string} command the command to execute
     * @param {Process} process the process
     * @param {Function} callback the callback function
     */
    private executeCommand(command: string, process: Process, callback: Function): void {
        let exec = childProcess.exec;
        Logger.log("info", "Execute command: " + command, "ExecutableHelper");
        exec(command, { maxBuffer: 1024 * 48828 }, function (error: any, stdout: any, stderr: any) {
            Statistics.endRecording(process.id, process.req.originalUrl);
            process.resultHandler.handleResult(error, stdout, stderr, process, callback);
        });
    }

    /**
     * Executes a process on the same host as this DivaServices instance is running
     * @param {Process} process The process to execute
     */
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

    /**
     * Executes a request on the Sun Grid Engine
     * @param {Process} process The process to execute
     */
    public executeRemoteRequest(process: Process): void {
        let self = this;
        async.waterfall([
            function (callback: Function) {
                //self.remoteExecution.uploadFile(process.image.path, process.rootFolder, callback);
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

    /**
     * Executes a request on a docker instance
     * @param {Process} process The process to execute
     * @param {Function} callback The callback
     */
    public static executeDockerRequest(process: Process, callback: Function): void {
        process.id = Statistics.startRecording(process);
        process.remoteResultUrl = "http://" + nconf.get("docker:reportHost") + "/jobs/" + process.id;
        process.remoteErrorUrl = "http://" + nconf.get("docker:reportHost") + "/algorithms/" + process.algorithmIdentifier + "/exceptions/" + process.id;
        let serviceInfo = ServicesInfoHelper.getInfoByPath(process.req.originalUrl);
        DockerManagement.runDockerImage(process, serviceInfo.image_name, callback);
    }

    /**
     * preprocess all the necessary information from the incoming POST request
     * This will either lead to the execution of one single image or the whole collection
     * @param {any} req The incoming request
     * @param {ProcessingQueue} processingQueue The Processing Queue to use
     * @param {string} executionType The execution type (e.g. java)
     * @param {Function} requestCallback The callback for the incoming request
     * @param {Function} queueCallback The callback for the processing queue
     */
    public async preprocess(req: any, processingQueue: ProcessingQueue, executionType: string): Promise<any> {
        return new Promise<any>(async(resolve, reject) => {
            let serviceInfo = ServicesInfoHelper.getInfoByPath(req.originalUrl);
            let collection = new Collection();
            collection.method = serviceInfo.service;
            collection.name = RandomWordGenerator.generateRandomWord();
            collection.outputFolder = IoHelper.getOutputFolder(collection.name);
            collection.inputParameters = _.clone(req.body.parameters);
            collection.inputData = _.clone(req.body.data);
            this.setCollectionHighlighter(collection, req);
            collection.neededParameters = serviceInfo.parameters;
            collection.neededData = serviceInfo.data;
            //perform parameter matching on collection level
            await ParameterHelper.matchCollectionParams(collection, req);
            //create prorcesses
            let index: number = 0;
            for (let element of collection.inputData) {
                let proc: Process = new Process();
                proc.req = _.clone(req);
                proc.algorithmIdentifier = serviceInfo.identifier;
                proc.executableType = serviceInfo.executableType;
                //Todo fix that to create the deeper nesting
                proc.outputFolder = collection.outputFolder + path.sep + "data_" + index + path.sep;
                IoHelper.createFolder(proc.outputFolder);
                proc.inputHighlighters = collection.inputHighlighters;
                proc.neededParameters = collection.neededParameters;
                proc.neededData = collection.neededData;
                proc.parameters = collection.parameters;
                proc.remotePaths = serviceInfo.remotePaths;
                proc.matchedParameters = serviceInfo.paramOrder;
                proc.method = collection.method;
                let resultHandler = null;
                proc.methodFolder = path.basename(proc.outputFolder);
                proc.programType = serviceInfo.programType;
                proc.executablePath = serviceInfo.executablePath;
                proc.resultType = serviceInfo.output;
                proc.resultFile = IoHelper.buildResultfilePath(proc.outputFolder, proc.methodFolder);
                proc.tmpResultFile = IoHelper.buildTempResultfilePath(proc.outputFolder, proc.methodFolder);
                proc.resultLink = proc.buildGetUrl();
                switch (proc.resultType) {
                    case "console":
                        resultHandler = new ConsoleResultHandler(proc.resultFile);
                        break;
                    case "file":
                        proc.parameters.params["resultFile"] = proc.resultFile;
                        resultHandler = new FileResultHandler(proc.resultFile);
                        break;
                    case "none":
                        resultHandler = new NoResultHandler(proc.resultFile);
                        break;
                }
                proc.resultHandler = resultHandler;
                collection.processes.push(proc);
                index++;
                await ParameterHelper.matchProcessData(proc, element);
                await ParameterHelper.matchOrder(proc);
                processingQueue.addElement(proc);
                Logger.log("info", "finished preprocessing", "ExecutableHelper");
            }
            resolve(collection.result);
        });

    }


    /**
    * Get the execution type
    * @param {string} programType the type of the program
    * @returns {string} the executable code for this program type
    */
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

    /**
     * Set the highlighter object on a collection
     * @param {Collection} collection the collection to set the highlighter for
     * @param {*} req the incoming POST request
     */
    private setCollectionHighlighter(collection: Collection, req: any): void {
        if (req.body.inputs != null && req.body.inputs.highlighter != null) {
            collection.inputHighlighters = _.clone(req.body.inputs.highlighter);
        } else {
            collection.inputHighlighters = {};
        }
    }

}