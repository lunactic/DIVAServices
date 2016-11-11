/**
 * Created by lunactic on 04.11.16.
 */

import * as _ from "lodash";
import * as express from "express";
let crypto = require("crypto");
import {IoHelper} from "../helper/ioHelper";
import {Logger} from "../logging/logger";
import * as nconf from "nconf";
import * as path from "path";
import {ServicesInfoHelper} from "../helper/servicesInfoHelper";
import {DockerManagement} from "../docker/dockerManagement";
import {ExecutableHelper} from "../helper/executableHelper";
import {QueueHandler} from "../processingQueue/queueHandler";
import {Swagger} from "../swagger/swagger";

export class AlgorithmManagement {


    static createAlgorithm(req: express.Request, res: express.Response, route: string, identifier: string, imageName: string, callback: Function): void {
        AlgorithmManagement.updateServicesFile(req.body, identifier, route, imageName);
        IoHelper.downloadFile(req.body.method.file, nconf.get("paths:executablePath") + path.sep + route, "application/zip", function (err: any, filename: string) {
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
                        if (!(nconf.get("reservedWords").indexOf(_.keys(input)[0]) >= 0) || _.keys(input)[0] === "highlighter") {
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
                                    inputs[input.json.name] = IoHelper.loadFile(nconf.get("paths:testPath") + path.sep + "json" + path.sep + "array.json");
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
                            inputs: inputs
                        }
                    };
                    executableHelper.preprocess(testRequest, QueueHandler.dockerProcessingQueue, "test", function (error: any, response: any) {
                        if (error != null) {
                            Logger.log("error", error, "AlgorithmManagement");
                        }
                    }, function () {
                        let job = QueueHandler.dockerProcessingQueue.getNext();
                        QueueHandler.runningDockerJobs.push(job);
                        executableHelper.executeDockerRequest(job, function (error: any, data: any) {
                            if (error == null) {
                                AlgorithmManagement.updateRootInfoFile(req.body, route);
                                AlgorithmManagement.createInfoFile(req.body, nconf.get("paths:jsonPath") + path.sep + route);
                                //Add to swagger
                                let info = IoHelper.loadFile(nconf.get("paths:jsonPath") + path.sep + route + path.sep + "info.json");
                                Swagger.createEntry(info, route);
                            }
                        });
                    });
                }
            });
        });
    }

    static getStatusByIdentifier(identifier: string): any {
        let content = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        let info: any = _.find(content.services, {"identifier": identifier});
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

    static getStatusByRoute(route: string): any {
        let content = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        let status = _.find(content.services, {"path": route});
        if (status != null) {
            return status;
        } else {
            return null;
        }
    }

    static createIdentifier(): string {
        let currentDate = (new Date()).valueOf().toString();
        let random = Math.random().toString();
        return crypto.createHash("sha1").update(currentDate + random).digest("hex");
    }

    static generateRoute(algorithm: any): string {
        return algorithm.general.type.toLowerCase() + "/" + algorithm.general.name.replace(/\s/g, "").toLowerCase() + "/1";
    }

    static generateFolders(route: string): void {
        IoHelper.createFolder(nconf.get("paths:executablePath") + path.sep + route);
        IoHelper.createFolder(nconf.get("paths:jsonPath") + path.sep + route);
    }

    static generateImageName(algorithm: any): string {
        return algorithm.general.type.toLowerCase() + algorithm.general.name.toLowerCase().replace(/\s/g, "_");
    }

    static createInfoFile(algorithm: any, folder: string) {
        let data = _.cloneDeep(algorithm);
        let reservedWords = _.clone(nconf.get("reservedWords"));
        _.remove(reservedWords, function (word: any) {
            return (word === "highlighter");
        });
        _.unset(data, "output");
        _.unset(data, "method");

        _.forEach(data.input, function (input: any) {
            if (_.includes(reservedWords, _.keys(input)[0])) {
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

    static deleteInfoFile(folder: string): void {
        IoHelper.deleteFile(folder + path.sep + "info.json");
    }

    static updateRootInfoFile(algorithm: any, route: string): void {
        let fileContent = IoHelper.loadFile(nconf.get("paths:rootInfoFile"));
        let newEntry = {
            name: algorithm.general.name,
            description: algorithm.general.description,
            type: algorithm.general.type,
            url: "http://$BASEURL$/" + route
        };
        fileContent.push(newEntry);
        IoHelper.saveFile(nconf.get("paths:rootInfoFile"), fileContent, "utf8", null);
    }

    static removeFromRootInfoFile(route: string): void {
        let fileContent = IoHelper.loadFile(nconf.get("paths:rootInfoFile"));
        _.remove(fileContent, function (entry: any) {
            return entry.url === "http://$BASEURL$" + route;
        });
        IoHelper.saveFile(nconf.get("paths:rootInfoFile"), fileContent, "utf8", null);
    }

    static removeFromServiceInfoFile(route: string): void {
        let fileContent = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        _.remove(fileContent.services, {"path": route});
        IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), fileContent, "utf8", null);
    }

    static updateStatus(identifier: string, status: any, route: string, message: string): void {
        let content = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        let currentInfo: any = {};
        if (identifier != null && _.find(content.services, {"identifier": identifier}) != null) {
            currentInfo = _.find(content.services, {"identifier": identifier});
        } else if (route != null && _.find(content.services, {"path": route}) != null) {
            currentInfo = _.find(content.services, {"path": route});
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

    static updateRoute(identifier: string, route: string): void {
        let content = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, {"identifier": identifier}) != null) {
            let currentInfo: any = _.find(content.services, {"identifier": identifier});
            currentInfo.path = route;
            IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), content, "utf8", null);
        }
    }

    static addUrlParameter(identifier: string, parameterName: string): void {
        let content = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, {"identifier": identifier}) != null) {
            let currentInfo: any = _.find(content.services, {"identifier": identifier});
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

    static addRemotePath(identifier: string, parameterName: string, remotePath: string): void {
        let content = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, {"identifier": identifier}) != null) {
            let currentInfo: any = _.find(content.services, {"identifier": identifier});
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


    static recordException(identifier: string, exception: any): void {
        let content = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, {"identifier": identifier}) != null) {
            let currentInfo: any = _.find(content.services, {"identifier": identifier});
            let message = {
                date: new Date().toJSON(),
                errorMessage: exception
            };
            currentInfo.exceptions.push(message);
            IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), content, "utf8", null);
        }
    }

    static getExceptions(identifier: string): any {
        let content = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        if (identifier != null && _.find(content.services, {"identifier": identifier}) != null) {
            let currentInfo: any = _.find(content.services, {"identifier": identifier});
            return currentInfo.exceptions;
        }
        return null;
    }

    //TODO make changes for docker or create a separate method
    static updateServicesFile(algorithm: any, identifier: string, route: string, imageName: string): void {
        ServicesInfoHelper.reload();
        if ((this.getStatusByIdentifier(identifier) == null) && (this.getStatusByRoute(route) == null)) {
            let newContent = _.cloneDeep(ServicesInfoHelper.fileContent);
            let parameters: any = [];
            _.forEach(algorithm.input, function (input: any, key: any) {
                let inputType = _.keys(input)[0];
                key = _.get(algorithm, "input[" + key + "]." + inputType + ".name", inputType);
                let info: any = {};
                info[key] = inputType;
                parameters.push(info);
            });

            let newServiceEntry = {
                service: route.replace(/\//g, "").toLowerCase(),
                identifier: identifier,
                path: "/" + route,
                executablePath: nconf.get("paths:executablePath") + path.sep + route + path.sep + algorithm.method.executable_path,
                allowParallel: true,
                output: "file",
                execute: "docker",
                executableType: algorithm.method.executableType,
                image_name: imageName,
                parameters: parameters,
                remotePaths: [],
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

    static updateIdentifier(route: string, identifier: string): void {
        let content = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
        let service: any = _.find(content.services, {"path": route});
        service.identifier = identifier;
        ServicesInfoHelper.update(content);
        ServicesInfoHelper.reload();
    }
}