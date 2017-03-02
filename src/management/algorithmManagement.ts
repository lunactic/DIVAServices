/**
 * Created by lunactic on 04.11.16.
 */
import * as _ from "lodash";
import * as express from "express";
import { IoHelper } from "../helper/ioHelper";
import { Logger } from "../logging/logger";
import * as nconf from "nconf";
import * as path from "path";
import { ServicesInfoHelper } from "../helper/servicesInfoHelper";
import { DockerManagement } from "../docker/dockerManagement";
import { ExecutableHelper } from "../helper/executableHelper";
import { QueueHandler } from "../processingQueue/queueHandler";
import { Swagger } from "../swagger/swagger";
let crypto = require("crypto");

/**
 * class for automated algorithm management
 * 
 * The functionality of this class is closely related to DIVAServices-Management (see: https://github.com/lunactic/DIVAServices-Management)
 * 
 * @export
 * @class AlgorithmManagement
 */
export class AlgorithmManagement {

    /**
     * Create a new algorithm on DIVAServices
     * 
     * This method performs the following steps:
     *  - update the services file
     *  - create the docker image
     *  - run the image once with default values
     * 
     * @static
     * @param {express.Request} req the incoming POST request
     * @param {express.Response} res the HTTP response object
     * @param {string} route the called route
     * @param {string} identifier the identifier to use
     * @param {string} imageName the name of the image
     * @param {number} version the version number
     * @param {string} baseroute the base route information
     * @param {Function} callback the callback function
     * 
     * @memberOf AlgorithmManagement
     */
    static createAlgorithm(req: express.Request, res: express.Response, route: string, identifier: string, imageName: string, version: number, baseroute: string, callback: Function): void {
        AlgorithmManagement.updateServicesFile(req.body, identifier, route, imageName, version, baseroute);
        IoHelper.downloadFileWithTypecheck(req.body.method.file, nconf.get("paths:executablePath") + path.sep + route, "application/zip", function (err: any, filename: string) {
            if (err != null) {
                AlgorithmManagement.updateStatus(identifier, "error", null, "algorithm file has the wrong format");
                let error = {
                    statusCode: 500,
                    identifier: identifier,
                    statusText: "fileUrl does not point to a correct zip file",
                    errorType: "WrongFileFormat"
                };
                callback(error, null);
            } else {
                //create docker file
                DockerManagement.createDockerFile(req.body, nconf.get("paths:executablePath") + path.sep + route);
                //create bash script
                DockerManagement.createBashScript(identifier, req.body, nconf.get("paths:executablePath") + path.sep + route);
                //update services file
                AlgorithmManagement.updateStatus(identifier, "creating", "/" + route, null);
                let response = {
                    statusCode: 200,
                    identifier: identifier,
                    statusText: "Started Algorithm Creation"
                };
                callback(null, response);
            }
            DockerManagement.buildImage(nconf.get("paths:executablePath") + path.sep + route, imageName, function (error: any, response: any) {
                if (error != null) {
                    AlgorithmManagement.updateStatus(identifier, "error", null, error.statusMessage);
                } else {
                    AlgorithmManagement.updateStatus(identifier, "testing", null, null);
                    let executableHelper = new ExecutableHelper();
                    let inputs = {};
                    let highlighter = {};
                    for (let input of req.body.input) {
                        if (!(nconf.get("reservedWords").indexOf(_.keys(input)[0]) >= 0) || _.keys(input)[0] === "highlighter" || _.keys(input)[0] === 'inputFile') {
                            switch (_.keys(input)[0]) {
                                case "select":
                                    inputs[input.select.name] = input.select.options.values[input.select.options.default];
                                    break;
                                case "number":
                                    inputs[input.number.name] = input.number.options.default;
                                    break;
                                case "text":
                                    inputs[input.text.name] = input.text.options.default;
                                    break;
                                case "json":
                                    inputs[input.json.name] = IoHelper.openFile(nconf.get("paths:testPath") + path.sep + "json" + path.sep + "array.json");
                                    break;
                                case "inputFile":
                                    inputs[input.inputFile.name] = input.inputFile.options.default;
                                    break;
                                case "highlighter":
                                    switch (input.highlighter.type) {
                                        case "polygon":
                                            highlighter = {
                                                type: "polygon",
                                                closed: true,
                                                segments: [[1, 1], [1, 150], [350, 150], [350, 1]]
                                            };
                                            break;
                                        case "rectangle":
                                        case "polygon":
                                            highlighter = {
                                                type: "rectangle",
                                                closed: true,
                                                segments: [[1, 1], [1, 150], [350, 150], [350, 1]]
                                            };
                                            break;
                                    }
                                    break;
                            }
                        }
                    }
                    inputs["highlighter"] = highlighter;
                    let testRequest = {
                        originalUrl: "/" + route,
                        body: {
                            images: [{
                                type: "collection",
                                value: "test"
                            }],
                            data: [{
                                type: "collection",
                                value: "test"
                            }],
                            inputs: inputs
                        }
                    };
                    
                    /*executableHelper.preprocess(testRequest, QueueHandler.dockerProcessingQueue, "test", function (error: any, response: any) {
                        if (error != null) {
                            Logger.log("error", error, "AlgorithmManagement");
                        }
                    }, function () {
                        let job = QueueHandler.dockerProcessingQueue.getNext();
                        QueueHandler.runningDockerJobs.push(job);
                        ExecutableHelper.executeDockerRequest(job, function (error: any, data: any) {
                            if (error == null) {
                                AlgorithmManagement.updateRootInfoFile(req.body, route);
                                AlgorithmManagement.createInfoFile(req.body, nconf.get("paths:jsonPath") + path.sep + route);
                                //Add to swagger
                                let info = IoHelper.openFile(nconf.get("paths:jsonPath") + path.sep + route + path.sep + "info.json");
                                Swagger.createEntry(info, route);
                            }
                        });
                    });*/
                }
            });
        });
    }

    /**
     * get the status of an algorithm based on its identifier
     * 
     * @static
     * @param {string} identifier the identifier
     * @returns {*} the current status
     * 
     * @memberOf AlgorithmManagement
     */
    static getStatusByIdentifier(identifier: string): any {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        let info: any = _.find(content.services, { "identifier": identifier });
        if (info != null) {
            let message = {
                status: info.status,
                statistics: info.statistics
            };
            return message;
        } else {
            return null;
        }
    }

    /**
     * get the status of an algorithm based off the route
     * 
     * @static
     * @param {string} route the route of the algorithm
     * @returns {*} the current status
     * 
     * @memberOf AlgorithmManagement
     */
    static getStatusByRoute(route: string): any {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        let status = _.find(content.services, { "baseRoute": route });
        if (status != null) {
            return status;
        } else {
            return null;
        }
    }

    static getVersionByBaseRoute(route: string): number {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        let algorithm: any = _.find(content.services, { "baseroute": route });
        if (algorithm != null) {
            return algorithm.version;
        } else {
            return 1;
        }
    }

    /**
     * create a new algorithm identifier
     * 
     * @static
     * @returns {string} the new identifier
     * 
     * @memberOf AlgorithmManagement
     */
    static createIdentifier(): string {
        let currentDate = (new Date()).valueOf().toString();
        let random = Math.random().toString();
        return crypto.createHash("sha1").update(currentDate + random).digest("hex");
    }

    /**
     * create a new route for an algorithm
     * 
     * @static
     * @param {*} algorithm the name of the algorithm
     * @returns {string} the dynamic route for this algorithm
     * 
     * @memberOf AlgorithmManagement
     */
    static generateBaseRoute(algorithm: any): string {
        return algorithm.general.type.toLowerCase() + "/" + algorithm.general.name.replace(/\s/g, "").toLowerCase();
    }

    /**
     * generate all necessary folders for a method
     * 
     * @static
     * @param {string} route the route of the new method
     * 
     * @memberOf AlgorithmManagement
     */
    static generateFolders(route: string): void {
        IoHelper.createFolder(nconf.get("paths:executablePath") + path.sep + route);
        IoHelper.createFolder(nconf.get("paths:jsonPath") + path.sep + route);
    }

    /**
     * generate the name of the image
     * 
     * @static
     * @param {*} algorithm the new algorithm
     * @param {number} version the version of the algorithm
     * @returns {string} the name for the image
     * 
     * @memberOf AlgorithmManagement
     */
    static generateImageName(algorithm: any, version: number): string {
        return algorithm.general.type.toLowerCase() + algorithm.general.name.toLowerCase().replace(/\s/g, "_") + ":" + String(version);
    }

    /**
     * create the algorithm information file
     * 
     * @static
     * @param {*} algorithm the algorithm information
     * @param {string} folder the algorithm folder
     * 
     * @memberOf AlgorithmManagement
     */
    static createInfoFile(algorithm: any, folder: string) {
        let data = _.cloneDeep(algorithm);
        let reservedWords = _.clone(nconf.get("reservedWords"));
        _.remove(reservedWords, function (word: any) {
            return (word === "highlighter");
        });
        _.unset(data, "output");
        _.unset(data, "method");

        _.forEach(data.input, function (input: any) {
            if (_.includes(reservedWords, _.keys(input)[0]) && _.keys(input)[0] !== 'inputFile') {
                input[_.keys(input)[0]]["userdefined"] = false;
            } else {
                input[_.keys(input)[0]]["userdefined"] = true;
            }
        });

        IoHelper.saveFile(folder + path.sep + "info.json", data, "utf8", function (err: any) {
            if (err != null) {
                Logger.log("error", err, "AlgorithmManagement");
            } else {
                Logger.log("info", "saved file", "AlgorithmManagement");
            }
        });
    }

    /**
     * delete the algorithm information file
     * 
     * @static
     * @param {string} folder the folder of the file
     * 
     * @memberOf AlgorithmManagement
     */
    static deleteInfoFile(folder: string): void {
        IoHelper.deleteFile(folder + path.sep + "info.json");
    }

    /**
     * add the new algorithm to the root information file
     * 
     * @static
     * @param {*} algorithm the new algorithm information
     * @param {string} route the route of the new algorithm
     * 
     * @memberOf AlgorithmManagement
     */
    static updateRootInfoFile(algorithm: any, route: string): void {
        let fileContent = IoHelper.openFile(nconf.get("paths:rootInfoFile"));
        let newEntry = {
            name: algorithm.general.name,
            description: algorithm.general.description,
            type: algorithm.general.type,
            url: "http://$BASEURL$/" + route
        };
        fileContent.push(newEntry);
        IoHelper.saveFile(nconf.get("paths:rootInfoFile"), fileContent, "utf8", null);
    }

    /**
     * remove algorithm information for the root info file
     * 
     * @static
     * @param {string} route the route to remove
     * 
     * @memberOf AlgorithmManagement
     */
    static removeFromRootInfoFile(route: string): void {
        let fileContent = IoHelper.openFile(nconf.get("paths:rootInfoFile"));
        _.remove(fileContent, function (entry: any) {
            return entry.url === "http://$BASEURL$" + route;
        });
        IoHelper.saveFile(nconf.get("paths:rootInfoFile"), fileContent, "utf8", null);
    }

    /**
     * remove algorithm information from the service information file
     * 
     * @static
     * @param {string} route the route to remove
     * 
     * @memberOf AlgorithmManagement
     */
    static removeFromServiceInfoFile(route: string): void {
        let fileContent = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        _.remove(fileContent.services, { "baseRoute": route });
        IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), fileContent, "utf8", null);
        ServicesInfoHelper.reload();
    }

    /**
     * update the status of an algorithm
     * 
     * @static
     * @param {string} identifier the algorithm information
     * @param {string} status the new status information
     * @param {string} route the route
     * @param {string} message the new message
     * 
     * @memberOf AlgorithmManagement
     */
    static updateStatus(identifier: string, status: string, route: string, message: string): void {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        let currentInfo: any = {};
        if (identifier != null && _.find(content.services, { "identifier": identifier }) != null) {
            currentInfo = _.find(content.services, { "identifier": identifier });
        } else if (route != null && _.find(content.services, { "path": route }) != null) {
            currentInfo = _.find(content.services, { "path": route });
        }

        switch (status) {
            case "creating":
                currentInfo.status.statusCode = 100;
                currentInfo.status.statusMessage = "Building Algorithm DivaImage";
                break;
            case "testing":
                currentInfo.status.statusCode = 110;
                currentInfo.status.statusMessage = "Testing Algorithm";
                break;
            case "ok":
                currentInfo.status.statusCode = 200;
                currentInfo.status.statusMessage = "Algorithm is Available";
                break;
            case "error":
                currentInfo.status.statusCode = 500;
                currentInfo.status.statusMessage = "Error: " + message;
                break;
            case "delete":
                currentInfo.status.statusCode = 410;
                currentInfo.status.statusMessage = "This algorithm is no longer available";
                break;
        }
        IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), content, "utf8", null);
    }

    /**
     * update the route for an existing algorithm when the algorithm is updated
     * 
     * @static
     * @param {string} identifier the identifier to update
     * @param {string} route the new route 
     * 
     * @memberOf AlgorithmManagement
     */
    static updateRoute(identifier: string, route: string): void {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, { "identifier": identifier }) != null) {
            let currentInfo: any = _.find(content.services, { "identifier": identifier });
            currentInfo.path = route;
            IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), content, "utf8", null);
        }
    }

    /**
     * add a url parameter to a method
     * 
     * this is used when a method requires additional input files that need to be downloaded
     * 
     * @static
     * @param {string} identifier the algorithm identifier
     * @param {string} parameterName the name of the parameter
     * 
     * @memberOf AlgorithmManagement
     */
    static addUrlParameter(identifier: string, parameterName: string): void {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, { "identifier": identifier }) != null) {
            let currentInfo: any = _.find(content.services, { "identifier": identifier });
            let info: any = {};
            let exists: boolean = false;

            _.forEach(currentInfo.parameters, function (value: any, key: any) {
                if (_.has(value, parameterName)) {
                    exists = true;
                }
            });

            if (!exists) {
                info[parameterName] = "url";
                currentInfo.parameters.unshift(info);
            }
            IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), content, "utf8", null);
        }
    }

    /**
     * 
     * add a remote path to a method
     * 
     * this is used for the replacement of fix remote paths
     * 
     * @static
     * @param {string} identifier the algorithm identifier
     * @param {string} parameterName the name of the parameter
     * @param {string} remotePath the remote path value
     * 
     * @memberOf AlgorithmManagement
     */
    static addRemotePath(identifier: string, parameterName: string, remotePath: string): void {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, { "identifier": identifier }) != null) {
            let currentInfo: any = _.find(content.services, { "identifier": identifier });
            let info: any = {};
            let exists: boolean = false;
            _.forEach(currentInfo.remotePaths, function (value: any, key: any) {
                if (_.has(value, parameterName)) {
                    exists = true;
                }
            });

            if (!exists) {
                info[parameterName] = remotePath;
                currentInfo.remotePaths.push(info);
            }
            IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), content, "utf8", null);
        }
    }

    static hasRemotePath(identifier: string, parameterName: string): boolean {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, { "identifier": identifier }) != null) {
            let currentInfo: any = _.find(content.services, { "identifier": identifier });
            let remotePath = _.find(currentInfo.remotePaths, function (path) {
                return _.keys(path)[0] === parameterName;
            });
            return remotePath != null;
        }
        return false;
    }

    static getRemotePath(identifier: string, parameterName: string): string {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, { "identifier": identifier }) != null) {
            let currentInfo: any = _.find(content.services, { "identifier": identifier });
            let remotePath = _.find(currentInfo.remotePaths, function (path) {
                return _.keys(path)[0] === parameterName;
            });
            return String(_.values(remotePath)[0]);
        }
        return "";
    }

    /**
     * record an execution exception for an algorithm
     * 
     * @static
     * @param {string} identifier the algorithm identifier
     * @param {*} exception the execution that occured
     * 
     * @memberOf AlgorithmManagement
     */
    static recordException(identifier: string, exception: any): void {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, { "identifier": identifier }) != null) {
            let currentInfo: any = _.find(content.services, { "identifier": identifier });
            let message = {
                date: new Date().toJSON(),
                errorMessage: exception
            };
            currentInfo.exceptions.push(message);
            IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), content, "utf8", null);
        }
    }

    /**
     * get all exceptions of an algorithm
     * 
     * @static
     * @param {string} identifier the algorithm identifier
     * @returns {*} all occured exceptions
     * 
     * @memberOf AlgorithmManagement
     */
    static getExceptions(identifier: string): any {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, { "identifier": identifier }) != null) {
            let currentInfo: any = _.find(content.services, { "identifier": identifier });
            return currentInfo.exceptions;
        }
        return null;
    }

    /**
     * update the serivce info file
     * 
     * @static
     * @param {*} algorithm the new algorithm information
     * @param {string} identifier the algorithm identifier
     * @param {string} route the algorithm route
     * @param {string} imageName the name of the docker image
     * @param {number} version the version number of the algorithm
     * @param {string} baseRoute the base route without the version number
     * 
     * @memberOf AlgorithmManagement
     */
    static updateServicesFile(algorithm: any, identifier: string, route: string, imageName: string, version: number, baseRoute: string): void {
        //TODO make changes for docker or create a separate method
        ServicesInfoHelper.reload();
        if (this.getStatusByIdentifier(identifier) != null || this.getStatusByRoute(baseRoute) != null) {
            this.removeFromServiceInfoFile(baseRoute);
        }
        if ((this.getStatusByIdentifier(identifier) == null) && (this.getStatusByRoute(baseRoute) == null)) {
            let newContent = _.cloneDeep(ServicesInfoHelper.fileContent);
            let parameters: any = [];
            let data: any = [];
            let paramOrder: any = [];
            let fileCount: number = 0;
            _.forEach(algorithm.input, function (input: any, key: any) {
                let inputType = _.keys(input)[0];
                key = _.get(algorithm, "input[" + key + "]." + inputType + ".name", inputType);
                let info: any = {};
                if (inputType === 'file') {
                    fileCount++;
                    info[key] = inputType;
                    data.push(info);
                    paramOrder.push(info);
                } else {
                    info[key] = inputType;
                    parameters.push(info);
                    paramOrder.push(info);
                }
            });
            let newServiceEntry = {
                service: route.replace(/\//g, "").toLowerCase(),
                baseRoute: "/" + baseRoute,
                identifier: identifier,
                path: "/" + route,
                executablePath: nconf.get("paths:executablePath") + path.sep + route + path.sep + algorithm.method.executable_path,
                allowParallel: true,
                hasMultipleFiles: (fileCount > 1),
                hasData: (fileCount > 0),
                output: "file",
                execute: "docker",
                executableType: algorithm.method.executableType,
                image_name: imageName,
                parameters: parameters,
                data: data,
                paramOrder: paramOrder,
                remotePaths: [],
                version: version,
                status: {
                    statusCode: -1,
                    statusMessage: ""
                },
                statistics: {
                    runtime: -1,
                    executions: 0
                },
                exceptions: []
            };

            newContent.services.push(newServiceEntry);
            ServicesInfoHelper.update(newContent);
            ServicesInfoHelper.reload();
        }
    }

    /**
     * update the identifier of an algorithm
     * 
     * @static
     * @param {string} route the route of the algorithm
     * @param {string} identifier the new algorithm identifier
     * 
     * @memberOf AlgorithmManagement
     */
    static updateIdentifier(route: string, identifier: string): void {
        let content = IoHelper.openFile(nconf.get("paths:servicesInfoFile"));
        let service: any = _.find(content.services, { "path": route });
        service.identifier = identifier;
        ServicesInfoHelper.update(content);
        ServicesInfoHelper.reload();
    }
}