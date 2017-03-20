"use strict";
import { isNullOrUndefined } from 'util';
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
import { FileHelper } from "./fileHelper";
import { File } from "../models/file";
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
     */
    private executeCommand(command: string, process: Process): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let exec = childProcess.exec;
            Logger.log("info", "Execute command: " + command, "ExecutableHelper");
            exec(command, { maxBuffer: 1024 * 48828 }, async function (error: any, stdout: any, stderr: any) {
                Statistics.endRecording(process.id, process.req.originalUrl);
                try {
                    await process.resultHandler.handleResult(error, stdout, stderr, process);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Executes a process on the same host as this DivaServices instance is running
     * @param {Process} process The process to execute
     */
    public async executeLocalRequest(process: Process) {
        let self = this;
        process.id = Statistics.startRecording(process);
        let command = self.buildCommand(process);
        if (process.resultType === "console") {
            command += " 1>" + process.tmpResultFile + ";mv " + process.tmpResultFile + " " + process.resultFile;
        }
        await self.executeCommand(command, process);
        self.emit("processingFinished");
        Promise.resolve();
    }

    /**
     * Executes a request on the Sun Grid Engine
     * @param {Process} process The process to execute
     */
    public async executeRemoteRequest(process: Process) {
        let self = this;
        try {
            for (let dataItem of process.data) {
                await self.remoteExecution.uploadFile((dataItem as File).path, process.rootFolder);
            }
            let command = self.buildCommand(process);
            process.id = Statistics.startRecording(process);
            command += " " + process.id + " " + process.rootFolder + " > /dev/null";
            self.remoteExecution.executeCommand(command);
            Promise.resolve();
        } catch (error) {
            Logger.log("error", error, "ExecutableHelper");
            Promise.reject(error);
        }
    }

    /**
     * Executes a request on a docker instance
     * @param {Process} process The process to execute
     */
    public static executeDockerRequest(process: Process): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            process.id = Statistics.startRecording(process);
            process.remoteResultUrl = "http://" + nconf.get("docker:reportHost") + "/jobs/" + process.id;
            process.remoteErrorUrl = "http://" + nconf.get("docker:reportHost") + "/algorithms/" + process.algorithmIdentifier + "/exceptions/" + process.id;
            let serviceInfo = ServicesInfoHelper.getInfoByPath(process.req.originalUrl);
            try {
                await DockerManagement.runDockerImage(process, serviceInfo.image_name);
                resolve();
            } catch (error) {
                reject(error);
            }
        });

    }

    /**
     * preprocess all the necessary information from the incoming POST request
     * This will either lead to the execution of one single image or the whole collection
     * @param {any} req The incoming request
     * @param {ProcessingQueue} processingQueue The Processing Queue to use
     * @param {string} executionType The execution type (e.g. java)
     */
    public async preprocess(req: any, processingQueue: ProcessingQueue, executionType: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            let serviceInfo = ServicesInfoHelper.getInfoByPath(req.originalUrl);
            let collection = new Collection();
            collection.method = serviceInfo.service;
            collection.name = RandomWordGenerator.generateRandomWord();
            collection.outputFolder = IoHelper.getOutputFolder(collection.name);
            collection.inputParameters = _.clone(req.body.parameters);
            collection.inputData = _.clone(req.body.data);
            collection.resultFile = collection.outputFolder + path.sep + "info.json";
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
                proc.type = executionType;
                proc.algorithmIdentifier = serviceInfo.identifier;
                proc.executableType = serviceInfo.executableType;
                //Todo fix that to create the deeper nesting
                proc.outputFolder = collection.outputFolder + path.sep + "data_" + index + path.sep;
                proc.inputHighlighters = _.clone(collection.inputHighlighters);
                proc.neededParameters = _.clone(collection.neededParameters);
                proc.neededData = _.clone(collection.neededData);
                proc.parameters = _.clone(collection.parameters);
                proc.remotePaths = serviceInfo.remotePaths;
                proc.matchedParameters = serviceInfo.paramOrder;
                proc.method = collection.method;
                proc.rootFolder = collection.name;
                let resultHandler = null;
                proc.methodFolder = path.basename(proc.outputFolder);
                proc.programType = serviceInfo.programType;
                proc.executablePath = serviceInfo.executablePath;
                proc.resultType = serviceInfo.output;

                //assign temporary file paths, these might change if existing results are found
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
                //try to find existing results
                await ParameterHelper.loadParamInfo(proc);
                if (isNullOrUndefined(proc.resultFile)) {
                    IoHelper.createFolder(proc.outputFolder);
                    proc.resultFile = IoHelper.buildResultfilePath(proc.outputFolder, proc.methodFolder);
                    proc.tmpResultFile = IoHelper.buildTempResultfilePath(proc.outputFolder, proc.methodFolder);
                    proc.resultLink = proc.buildGetUrl();
                    await ParameterHelper.saveParamInfo(proc);
                    processingQueue.addElement(proc);
                }
                Logger.log("info", "finished preprocessing", "ExecutableHelper");
            }
            let results = [];
            for (let process of collection.processes) {
                results.push({ "md5": process.data.md5, "resultLink": process.resultLink });
            }
            if (isNullOrUndefined(collection.result)) {
                collection.result = {
                    results: results,
                    collection: collection.name,
                    resultLink: collection.buildGetUrl(),
                    status: "done"
                };
            }
            //await ResultHelper.saveResult(collection);
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