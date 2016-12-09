/**
 * Created by lunactic on 04.11.16.
 */

import * as _ from "lodash";
import {AlgorithmManagement} from "../management/algorithmManagement";
import * as archiver from "archiver";
import * as fs from "fs";
import * as nconf from "nconf";
import * as path from "path";
import {IoHelper} from "../helper/ioHelper";
import {ResultHelper} from "../helper/resultHelper";
import {Logger}  from "../logging/logger";
let docker = require("dockerode");
let sequest = require("sequest");
import * as os from "os";
import {Process} from "../processingQueue/process";

export class DockerManagement {
    static docker = new docker({host: nconf.get("docker:host"), port: nconf.get("docker:port")});

    static buildImage(inputFolder: string, imageName: string, callback: Function): void {
        //create tar file
        let output = fs.createWriteStream(inputFolder + path.sep + "archive.tar");
        let archive = archiver("tar");
        let self = this;

        output.on("close", function () {
            self.docker.buildImage(inputFolder + path.sep + "archive.tar", {
                t: imageName,
                q: true
            }, function (error: any, response: any) {
                let id = -1;
                let hasError: boolean = false;
                let errorMessage: string = "";
                if (error != null) {
                    Logger.log("error", error, "DockerManagement");
                    errorMessage = error;
                    hasError = true;
                } else {
                    response.on("data", function (data: any) {
                        if (hasError) {
                            let err = {
                                statusCode: 500,
                                statusMessage: errorMessage
                            };
                            callback(err, null);
                        }
                        try {
                            let json = JSON.parse(data.toString());
                            let id = json.stream.split(":")[1].replace(os.EOL, "");
                        } catch (error) {
                            hasError = true;
                            let err = {
                                statusCode: 500,
                                statusMessage: data.toString()
                            };
                            callback(err, null);
                        }
                    });
                    response.on("end", function () {
                        if (!hasError) {
                            Logger.log("info", "successfully build the image", "DockerManagement");
                            callback(null, id);
                        }
                    });
                }
            });
        });
        archive.pipe(output);
        archive.bulk([{
            expand: true,
            cwd: inputFolder + path.sep,
            src: ["*", "**/*"]
        }
        ]);
        archive.finalize();
    }

    static removeImage(imageName: string, callback: Function): void {
        this.docker.getImage(imageName).remove(function (err: any, data: any) {
            if (err != null) {
                Logger.log("error", err, "DockerManagement");
            }
            callback(null);
        });
    }

    static createDockerFile(algorithmInfos: any, outputFolder: string): void {
        let content: string = "FROM " + algorithmInfos.method.environment + os.EOL +
            'MAINTAINER marcel.wuersch@unifr.ch' + os.EOL;

        switch (nconf.get("baseImages:" + algorithmInfos.method.environment)) {
            case "apk":
                content += 'RUN apk update' + os.EOL +
                    'RUN apk add curl' + os.EOL;
                break;
            case "apt":
                content += 'RUN apt-get update' + os.EOL +
                    'RUN apt-get install wget unzip curl -y' + os.EOL;
                break;
        }

        content += 'RUN mkdir -p /data/output' + os.EOL +
            'WORKDIR /data' + os.EOL +
            'COPY . .' + os.EOL +
            'RUN ["chmod", "+x", "./script.sh"]' + os.EOL +
            'RUN unzip algorithm.zip' + os.EOL;

        if (algorithmInfos.method.executableType === "bash") {
            content += 'RUN ["chmod", "+x", "./' + algorithmInfos.method.executable_path + '"]' + os.EOL;
        }
        fs.writeFileSync(outputFolder + path.sep + "Dockerfile", content);
    }

    static createBashScript(identifier: string, algorithmInfos: any, outputFolder: string): void {
        let content: string = '#!/bin/sh' + os.EOL;

        //input count starts with 4. Params 1,2 and 3 are fix used
        // 1: resultResponseUrl
        // 2: errorResponseUrl
        // increase it for every additional file that needs to be downloaded
        let inputCount: number = 3;

        //check if additional files need to be downloaded
        algorithmInfos.input.forEach((input: any, index: any) => {
            let key = _.keys(algorithmInfos.input[index])[0];
            if (['json', 'file', 'inputFile'].indexOf(key) >= 0) {
                content += 'curl -o /data/' + input[key].name + '.' + input[key].options.fileType + ' $' + inputCount + os.EOL;
                AlgorithmManagement.addUrlParameter(identifier, input[key].name + "url");
                AlgorithmManagement.addRemotePath(identifier, input[key].name, "/data/" + input[key].name + "." + input[key].options.fileType);
                inputCount++;
            } else if (key === 'inputImage') {
                content += 'curl -o /data/inputImage.png $' + inputCount + os.EOL;
                inputCount++;
            }
        });

        switch (algorithmInfos.method.executableType) {
            case "java":
                content += 'java -Djava.awt.headless=true -Xmx4096m -jar /data/' + algorithmInfos.method.executable_path + ' ';
                break;
            case "coffeescript":
                content += 'coffee ' + algorithmInfos.method.executable_path + ' ';
                break;
            case "bash":
            case "matlab":
                content += '/data/' + algorithmInfos.method.executable_path + ' ';
                break;
        }

        algorithmInfos.input.forEach((input: any, index: number) => {
            let key = _.keys(algorithmInfos.input[index])[0];
            if (nconf.get("reservedWords").indexOf(key) >= 0 && nconf.get("docker:replacePaths").indexOf(key) >= 0) {
                content += this.getDockerInput(key) + " ";
                if (key !== 'inputImage') {
                    inputCount++;
                }
            } else {
                //TODO add switch for highlighters
                if (key === "highlighter") {
                    content += "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " ";
                } else {
                    content += "$" + inputCount + " ";
                    inputCount++;
                }
            }
        });

        if (algorithmInfos.method.executableType === "matlab") {
            content += '1> /data/result.json' + os.EOL;
        } else {
            content += '1> /data/result.json 2> /data/error.txt' + os.EOL;
        }
        content += 'if [ -s "/data/error.txt" ]' + os.EOL;
        content += 'then' + os.EOL;
        content += '    curl -H "Content-Type: text/plain" --data @/data/error.txt $2' + os.EOL;
        content += 'fi' + os.EOL;
        content += 'if [ -s "/data/result.json" ]' + os.EOL;
        content += 'then' + os.EOL;
        content += '    curl -H "Content-Type: application/json" --data @/data/result.json $1' + os.EOL;
        content += 'fi';
        fs.writeFileSync(outputFolder + path.sep + "script.sh", content);
    }

    static runDockerImage(process: Process, imageName: string, callback: Function): void {
        let params = process.parameters.params;
        let neededParams = process.neededParameters;
        let paramsPath = "";

        //get remote path keys
        let remoteKeys = [];
        for (let remote of process.remotePaths) {
            remoteKeys.push(_.keys(remote)[0]);
        }

        for (let key in params) {
            if (params.hasOwnProperty(key)) {
                let value = params[key];
                if (remoteKeys.indexOf(key) >= 0) {
                    paramsPath += '"' + _ .find(process.remotePaths, function (remotePath: any) {
                            return _.keys(remotePath)[0] === key;
                        })[key] + '" ';
                } else if (key === "highlighter") {
                    paramsPath += _.map(params.highlighter.split(" "), function (item: any) {
                        return '"' + item + '"';
                    }).join(" ");
                } else if (_.find(neededParams, key) != null && ["url"].indexOf(_.find(neededParams, key)[key]) >= 0) {
                    let originalKey = key.replace("url", "");
                    let originalValue = params[originalKey];
                    let url = "";
                    if (process.hasImages) {
                        url = IoHelper.getStaticImageUrlFull(originalValue);
                    } else {
                        url = IoHelper.getStaticDataUrlFull(originalValue);
                    }
                    paramsPath += '"' + url + '" ';
                } else {
                    paramsPath += '"' + value + '" ';
                }
            }
        }

        let command = './script.sh ' + process.remoteResultUrl + ' ' + process.remoteErrorUrl + ' ' + paramsPath;
        Logger.log("info", command, "DockerManagement");
        this.docker.run(imageName, ['-c', command], process.stdout, {entrypoint: '/bin/sh'}, function (error: any, data: any, container: any) {
            let err = {
                statusMessage: "Execution did not finish properly! status code is: " + data.statusCode
            };
            if (error != null) {
                Logger.log("error", error, "DockerManagement");
                if (callback != null) {
                    callback(error, null);
                }
            }
            if (data != null && data.StatusCode === 0) {
                container.remove(function (error: any, data: any) {
                    if (callback != null) {
                        callback(null, null);
                    }
                });
            } else if (data != null && data.StatusCode !== 0) {
                Logger.log("error", "Execution did not finish properly! status code is: " + data.statusCode, "DockerManagement");
            }

            if (process.type === "test" && data.StatusCode !== 0) {
                AlgorithmManagement.updateStatus(null, "error", process.req.originalUrl, "Algorithm image did not execute properly");
                ResultHelper.removeResult(process);

                container.remove(function (error: any, data: any) {
                    if (callback != null) {
                        callback(err, null);
                    }
                });
            }
        });
    }

    private static getDockerInput(input: string): string {
        return nconf.get("docker:paths:" + input);
    }
}