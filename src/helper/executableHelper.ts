"use strict";
/**
 * Created by Marcel Würsch on 07.11.16.
 */
import { EventEmitter } from "events";
import * as _ from 'lodash';
import * as nconf from 'nconf';
import * as path from 'path';
import { isNullOrUndefined } from 'util';
import { DockerManagement } from "../docker/dockerManagement";
import { Logger } from "../logging/logger";
import { AlgorithmManagement } from "../management/algorithmManagement";
import { Collection } from "../processingQueue/collection";
import { Process } from "../processingQueue/process";
import { ProcessingQueue } from "../processingQueue/processingQueue";
import { QueueHandler } from '../processingQueue/queueHandler';
import { RandomWordGenerator } from "../randomizer/randomWordGenerator";
import { Statistics } from "../statistics/statistics";
import { SchemaValidator } from "../validator/schemaValidator";
import { FileHelper } from "./fileHelper";
import { IoHelper } from "./ioHelper";
import { ParameterHelper } from "./parameterHelper";
import { ConsoleResultHandler } from "./resultHandlers/consoleResultHandler";
import { FileResultHandler } from "./resultHandlers/fileResultHandler";
import { NoResultHandler } from "./resultHandlers/noResultHandler";
import { ResultHelper } from "./resultHelper";
import { ServicesInfoHelper } from "./servicesInfoHelper";

/**
 * A class the provides all functionality needed before a process can be executed
 * 
 * @export
 * @class ExecutableHelper
 * @extends {EventEmitter}
 */
export class ExecutableHelper extends EventEmitter {


    /**
     * Creates an instance of ExecutableHelper.
     * @memberof ExecutableHelper
     */
    constructor() {
        super();
    }

    /**
     * 
     * Executes a request on a docker instance
     * @static
     * @param {Process} process The process to execute
     * @returns {Promise<void>} resolves before the process is spawned because of async execution
     * @memberof ExecutableHelper
     */
    public static executeDockerRequest(process: Process): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            process.id = Statistics.startRecording(process);
            let serviceInfo = await ServicesInfoHelper.getInfoByPath(process.req.originalUrl);
            //do not resolve test executions immediately but wait for them to be finished
            //this is important to not publish them too early
            if (process.type !== "test") {
                resolve();
            }
            try {
                if (nconf.get("server:cwlSupport")) {
                    await DockerManagement.runDockerImageSSH(process);
                    await this.endProcess(process);
                } else {
                    await DockerManagement.runDockerImage(process, serviceInfo.image_name);
                }
                if (process.type === "test") {
                    resolve();
                }
            } catch (error) {
                if (process.type !== "test") {
                    Statistics.removeActiveExecution(process.id);
                } else {
                    reject(error);
                }
            }
        });
    }

    /**
     * end a process, store statistics, and update status (if necessary)
     * 
     * @static
     * @param {Process} process the finished process
     * @returns {Promise<void>} 
     * @memberof ExecutableHelper
     */
    public static endProcess(process: Process): Promise<void> {
        return new Promise(async (resolve, reject) => {
            let startTime = Statistics.removeActiveExecution(process.id);
            await Statistics.endRecording(process.id, process.req.originalUrl, startTime);
            //check if we are running a test request here and need to update information
            if (process.type === "test") {
                try {
                    let results = await IoHelper.readFile(process.resultFile);
                    await SchemaValidator.validate(results, "responseSchema");
                    await AlgorithmManagement.testResults(results.output, process.outputs);
                    AlgorithmManagement.updateStatus(null, "ok", process.req.originalUrl, "");
                    await ResultHelper.removeResult(process);
                    resolve();
                } catch (error) {
                    AlgorithmManagement.updateStatus(null, "error", process.req.originalUrl, error.message);
                    await ResultHelper.removeResult(process);
                    reject(error);
                }
            } else {
                QueueHandler.executeDockerRequest();
            }
        });
    }

    /**
     * preprocess all the necessary information from the incoming POST request
     * This will either lead to the execution of one single image or the whole collection
     * @param {*} req The incoming request
     * @param {ProcessingQueue} processingQueue The Processing Queue to use
     * @param {string} executionType The execution type (e.g. java)
     * @returns {Promise<any>} A JSON object containing the response
     * @memberof ExecutableHelper
     */
    public async preprocess(req: any, processingQueue: ProcessingQueue, executionType: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                //add all information to the created collection of processes (things that are true for all processes)
                let serviceInfo = await ServicesInfoHelper.getInfoByPath(req.originalUrl);
                let collection = new Collection();
                let methodInfo = await IoHelper.readFile(nconf.get("paths:jsonPath") + req.originalUrl + path.sep + "info.json");
                collection.outputs = methodInfo.output;
                collection.method = serviceInfo.service;
                collection.name = RandomWordGenerator.generateRandomWord();
                collection.outputFolder = IoHelper.getOutputFolder(collection.name);
                collection.logFolder = IoHelper.getLogFolder(serviceInfo.path);
                collection.inputParameters = _.cloneDeep(req.body.parameters);
                collection.inputData = _.cloneDeep(req.body.data);
                collection.resultFile = nconf.get("paths:resultsPath") + path.sep + collection.name + ".json";
                let outputCollectionName = '';
                //Take the first entry from the data and its collection name as inputCollectionName
                if (executionType !== 'test') {
                    let inputCollectionName = req.body.data[0][Object.keys(req.body.data[0])[0]].split('/')[0];
                    let now: Date = new Date();
                    //Generate outputCollectionName from inputCollectionName and current date
                    outputCollectionName = inputCollectionName + '_' + serviceInfo.name + '_' + now.getFullYear() + '_' + now.getMonth() + '_' + now.getDay() + '_' + now.getHours() + '_' + now.getMinutes() + '_' + now.getSeconds();
                    await IoHelper.createFilesCollectionFolders(outputCollectionName);
                    FileHelper.createCollectionInformation(outputCollectionName, 0);
                }
                if (!isNullOrUndefined(req.body.identification)) {
                    collection.identification = req.body.identification;
                }
                this.setCollectionHighlighter(collection, req);
                collection.neededParameters = serviceInfo.parameters;
                collection.neededData = serviceInfo.data;
                //perform parameter matching on collection level
                await ParameterHelper.matchCollectionParams(collection, req);
                //create processes
                let index: number = 0;
                //check if some parameter expanding is needed
                collection.inputData = await ParameterHelper.expandDataWildcards(collection.inputData);
                //create all individual processes
                for (let element of collection.inputData) {
                    let proc: Process = new Process();
                    proc.req = _.cloneDeep(req);
                    proc.rewriteRules = serviceInfo.rewriteRules;
                    proc.resultCollection = outputCollectionName;
                    proc.algorithmIdentifier = serviceInfo.identifier;
                    proc.executableType = serviceInfo.executableType;
                    proc.outputFolder = collection.outputFolder + path.sep + "data_" + index + path.sep;
                    proc.inputHighlighters = _.cloneDeep(collection.inputHighlighters);
                    proc.neededParameters = _.cloneDeep(collection.neededParameters);
                    proc.neededData = _.cloneDeep(collection.neededData);
                    proc.parameters = _.cloneDeep(collection.parameters);
                    proc.remotePaths = _.cloneDeep(serviceInfo.remotePaths);
                    proc.outputs = collection.outputs;
                    proc.matchedParameters = _.cloneDeep(serviceInfo.paramOrder);
                    proc.method = serviceInfo.name;
                    proc.rootFolder = collection.name;
                    proc.methodFolder = path.basename(proc.outputFolder);
                    proc.programType = serviceInfo.programType;
                    proc.executablePath = serviceInfo.executablePath;
                    proc.resultType = serviceInfo.output;
                    proc.type = executionType;
                    proc.logFolder = collection.logFolder;
                    proc.yamlFile = proc.outputFolder + "data_" + index + ".yaml";
                    proc.cwlFile = nconf.get("paths:executablePath") + serviceInfo.path + path.sep + serviceInfo.identifier + ".cwl";
                    if (!isNullOrUndefined(collection.identification)) {
                        proc.identification = _.cloneDeep(collection.identification);
                        Statistics.recordUser(proc);
                    }
                    //assign temporary file paths, these might change if existing results are found
                    proc.resultFile = IoHelper.buildResultfilePath(proc.outputFolder, proc.methodFolder);
                    proc.tmpResultFile = IoHelper.buildTempResultfilePath(proc.outputFolder, proc.methodFolder);
                    let now: Date = new Date();

                    if (nconf.get("server:cwlSupport")) {
                        proc.stdLogFile = IoHelper.buildStdLogFilePath(collection.logFolder, now);
                        proc.errLogFile = IoHelper.buildErrLogFilePath(collection.logFolder, now);
                        proc.cwlLogFile = IoHelper.buildCwlLogFilePath(collection.logFolder, now);
                    } else {
                        proc.cwlLogFile = IoHelper.buildCwlLogFilePath(collection.logFolder, now);
                        proc.errLogFile = IoHelper.buildErrLogFilePath(collection.logFolder, now);

                    }
                    proc.resultLink = proc.buildGetUrl();

                    switch (proc.resultType) {
                        case "console":
                            proc.resultHandler = new ConsoleResultHandler(proc.resultFile);
                            break;
                        case "file":
                            proc.parameters.params["resultFile"] = proc.resultFile;
                            proc.resultHandler = new FileResultHandler(proc.resultFile, proc.tmpResultFile);
                            break;
                        case "none":
                            proc.resultHandler = new NoResultHandler(proc.resultFile);
                            break;
                    }
                    collection.processes.push(proc);
                    index++;
                    await ParameterHelper.matchProcessData(proc, element);
                    await ParameterHelper.matchOrder(proc);
                    //try to find existing results
                    await ParameterHelper.loadParamInfo(proc);
                    if (isNullOrUndefined(proc.resultFile)) {
                        await IoHelper.createFolder(proc.outputFolder);
                        proc.resultFile = IoHelper.buildResultfilePath(proc.outputFolder, proc.methodFolder);
                        proc.tmpResultFile = IoHelper.buildTempResultfilePath(proc.outputFolder, proc.methodFolder);
                        proc.resultLink = proc.buildGetUrl();
                        await ParameterHelper.saveParamInfo(proc);
                        await IoHelper.saveFile(proc.resultFile, { status: "planned" }, "utf8");
                        processingQueue.addElement(proc);
                    }
                    Logger.log("info", "finished preprocessing", "ExecutableHelper");
                }
                let results = [];
                for (let process of collection.processes) {
                    results.push({ "resultLink": process.resultLink });
                }
                if (isNullOrUndefined(collection.result)) {
                    collection.result = {
                        results: results,
                        resultCollection: outputCollectionName,
                        resultCollectionLink: 'http://' + nconf.get('server:rootUrl') + '/collections/' + outputCollectionName,
                        resultLink: collection.buildGetUrl(),
                        message: "This url is available for 24 hours",
                        status: "done"
                    };
                }
                await ResultHelper.saveResult(collection);
                resolve(collection.result);
            } catch (error) {
                reject(error);
            }
        });

    }

    /**
     * Set the highlighter information for a collection
     * 
     * @private
     * @param {Collection} collection the collection to set the highlighter for
     * @param {*} req the incoming POST request
     * @memberof ExecutableHelper
     */
    private setCollectionHighlighter(collection: Collection, req: any): void {
        if (req.body.parameters != null && req.body.parameters.highlighter != null) {
            collection.inputHighlighters = _.cloneDeep(req.body.parameters.highlighter);
        } else {
            collection.inputHighlighters = {};
        }
    }
}