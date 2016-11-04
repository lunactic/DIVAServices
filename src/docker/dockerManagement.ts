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
import logger = require("../logging/logger");
let Docker = require("dockerode");
let sequest = require("sequest");
import Process = require("../processingQueue/process");

export class DockerManagement {
    static docker = new Docker({host: nconf.get("docker:host"), port: nconf.get("docker:port")});

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
                    logger.log("error", error, "DockerManagement");
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
                            let id = json.stream.split(":")[1].replace("\n", "");
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
                            logger.log("info", "successfully build the image", "DockerManagement");
                            callback(null, id);
                        }
                    });
                }
            });
            archive.pipe(output);
            archive.bulk([{
                expand: true,
                cwd: inputFolder + path.sep,
                src: ["*", "**/*"]
            }
            ]);
            archive.finalize();
        });
    }

    static removeImage(imageName: string, callback: Function): void {
        this.docker.getImage(imageName).remove(function (err: any, data: any) {
            if (err != null) {
                logger.log("error", err, "DockerManagement");
            }
            callback(null);
        });
    }

    static createDockerFile(algorithmInfos: any, outputFolder: string): void {
        let content: string = "FROM " + algorithmInfos.method.environment + "\n" +
            "MAINTAINER marcel.wuersch@unifr.ch \n";

        switch (nconf.get("baseImages:" + algorithmInfos.method.environment)) {
            case "apk":
                content += "RUN apk update \n" +
                    "RUN apk add curl \n";
                break;
            case "apt":
                content += "RUN apt-get update \n" +
                    "RUN apt-get install wget unzip curl -y \n";
                break;
        }

        content += "RUN mkdir -p /data/output \n" +
            "WORKDIR /data \n" +
            "COPY . . \n" +
            "RUN ['chmod', '+x', './script.sh'] \n" +
            "RUN unzip algorithm.zip \n";

        if (algorithmInfos.method.executableType === "bash") {
            content += "RUN ['chmod', '+x', './" + algorithmInfos.method.executable_path + "'] \n";
        }
        IoHelper.saveFile(outputFolder + path.sep + "Dockerfile", content, "utf8", null);
    }

    static createBashScript(identifier: string, algorithmInfos: any, outputFolder: string): void {
        let content: string = "#!/bin/sh\n";

        if (_.find(algorithmInfos.input, {"inputImage": {}}) != null) {
            content += "curl -o /data/inputImage.png $1\n";
        }
        //input count starts with 4. Params 1,2 and 3 are fix used
        // 1: inputImageUrl
        // 2: resultResponseUrl
        // 3: eroorResponseUrl
        // increase it for every additional file that needs to be downloaded
        let inputCount: number = 4;

        //check if additional files need to be downloaded
        algorithmInfos.input.forEach((input: any, index: any) => {
            let key = _.keys(algorithmInfos.input[index])[0];
            if (key in ["json", "file"]) {
                content += "curl -o /data/" + input[key].name + ".json $" + inputCount + "\n";
                AlgorithmManagement.addUrlParameter(identifier, input[key].name + "url");
                AlgorithmManagement.addRemotePath(identifier, input[key].name, "/data/" + input[key].name + ".json");
                inputCount++;
            }
        });

        switch (algorithmInfos.method.executableType) {
            case "java":
                content += "java -Djava.awt.headless=true -Xmx4096m -jar /data/ " + algorithmInfos.method.executable_path + " ";
                break;
            case "coffeescript":
                content += "coffee " + algorithmInfos.method.executable_path + " ";
                break;
            case "bash":
            case "matlab":
                content += "/data/" + algorithmInfos.method.executable_path + " ";
                break;
        }

        algorithmInfos.inputs.forEach((input: any, index: number) => {
            let key = _.keys(algorithmInfos.input[index])[0];
            if (key in nconf.get("reservedWords") && key in nconf.get("docker:replacePaths")) {
                content += this.getDockerInput(key) + " ";
                inputCount++;
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
            content += ">1 /data/result.json \n";
        } else {
            content += ">1 /data/result.json 2> /data/error.txt \n";
        }
        content += "if [ -s '/data/error.txt' ] \n";
        content += "then \n";
        content += "    curl -H 'Content-Type: text/plain' --data @/data/error.txt $3 \n";
        content += "fi \n";
        content += "if [ -s '/data/result.json' ] \n";
        content += "then \n";
        content += "    curl -H 'Content-Type: application/json' --data @/data/result.json $2 \n";
        content += "fi";
        fs.writeFileSync(outputFolder + path.sep + "script.sh", content);
    }

    static runDockerImage(process: Process, imageName: string, callback: Function): void {
        let params = process.parameters.params;
        let neededParams = process.neededParameters;
        let paramsPath = "";

        for (let key in params) {
            let value = params[key];
            if (key === "highlighter") {
                paramsPath += _.map(params.highlighter.split(" "), function (item: any) {
                    return "'" + item + "'";
                }).join(" ");
            } else if (_.find(neededParams, key) != null && _.find(neededParams, key)[key] in ["url"]) {
                let originalKey = key.replace("url", "");
                let originalValue = params[originalKey];
                let url = "";
                if (process.hasImages) {
                    url = IoHelper.getStaticImageUrlFull(originalValue);
                } else {
                    url = IoHelper.getStaticDataUrlFull(originalValue);
                }
                paramsPath += "'" + url + "'";
            } else {
                paramsPath += "'" + value + "'";
            }
        }

        let command = "./script.sh " + process.inputImageUrl + " " + process.remoteResultUrl + " " + process.remoteErrorUrl + " " + paramsPath;
        logger.log("info", command, "DockerManagement");
        this.docker.run(imageName, ["sh", "-c", command], process.stdout, function (error: any, data: any, container: any) {
            if (error != null) {
                logger.log("error", error, "DockerManagement");
                if (callback != null) {
                    callback(error, null);
                }
            }
            if (data != null && data.statusCode === 0) {
                container.remove(function (error: any, data: any) {
                    if (callback != null) {
                        callback(null, null);
                    }
                });
            } else if (data != null && data.statusCode !== 0) {
                logger.log("error", "Execution did not finish properly! status code is: " + data.statusCode, "DockerManagement");
                var err = {
                    statusMessage: "Execution did not finish properly! status code is: " + data.statusCode
                };
            }

            if (process.type === "test" && data.status !== 0) {
                AlgorithmManagement.updateStatus(null, "error", process.req.originalUrl, "Algorithm image did not execute properly");
                ResultHelper.removeResult(process);

                container.remove(function (error: any, data: any) {
                    if (callback != null) {
                        callback(err, null);
                    }
                })
            }
        });
    }

    private static getDockerInput(input: string): string {
        return nconf.get("docker:paths:" + input);
    }
}