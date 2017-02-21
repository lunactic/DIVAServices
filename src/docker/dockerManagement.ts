/**
 * Created by lunactic on 04.11.16.
 */

import * as _ from "lodash";
import { AlgorithmManagement } from "../management/algorithmManagement";
import * as archiver from "archiver";
import * as fs from "fs";
import * as nconf from "nconf";
import * as path from "path";
import { IoHelper } from "../helper/ioHelper";
import { ResultHelper } from "../helper/resultHelper";
import { Logger } from "../logging/logger";
let DOCKER = require("dockerode");
let sequest = require("sequest");
import * as os from "os";
import { Process } from "../processingQueue/process";

/**
 * A class for managing, and running docker images
 */
export class DockerManagement {
    /**
     * The Docker communication object
     */
    static docker = new DOCKER({ host: nconf.get("docker:host"), port: nconf.get("docker:port") });

    /**
     * Create a new image
     * 
     * @param {string} inputFolder The folder where the container contents are stored
     * @param {string} imageName The name of the image to create
     * @param {Function} callback A callback containing either the error message or the id of the created image
     */
    static buildImage(inputFolder: string, imageName: string, callback: Function): void {
        //create tar file
        let output = fs.createWriteStream(inputFolder + path.sep + "archive.tar");
        let archive = archiver("tar");
        let self = this;

        //close handler for the archive
        output.on("close", function () {
            //create the docker image using the built archive file
            self.docker.buildImage(inputFolder + path.sep + "archive.tar", {
                t: imageName,
                q: true
            }, function (error: any, response: any) {
                //callback handler
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
        //build an archive of the current contents of the inputFolder
        archive.pipe(output);
        archive.bulk([{
            expand: true,
            cwd: inputFolder + path.sep,
            src: ["*", "**/*"]
        }
        ]);
        //build the archive --> this will trigger the "close" handler
        archive.finalize();
    }


    /**
     * Remove an image from the docker server
     * @param {String} imageName the name of the image to remove
     * @param {Function} callback - callback for handling returns
     */
    static removeImage(imageName: string, callback: Function): void {
        this.docker.getImage(imageName).remove(function (err: any, data: any) {
            if (err != null) {
                Logger.log("error", err, "DockerManagement");
            }
            callback(null);
        });
    }

    /**
     * Create and save a Dockerfile based on the algorithm information
     *
     * @param {any} algorithmInfos an object containing all necessary algorithm information
     * @param {string} outputFolder The folder where the Dockerfile will be saved
     */
    static createDockerFile(algorithmInfos: any, outputFolder: string): void {
        let content: string = "FROM " + algorithmInfos.method.environment + os.EOL +
            'MAINTAINER marcel.wuersch@unifr.ch' + os.EOL;

        switch (nconf.get("baseImages:" + algorithmInfos.method.environment)) {
            case "apk":
                content += 'RUN apk update' + os.EOL +
                    'RUN apk add curl bash' + os.EOL;
                break;
            case "apt":
                content += 'RUN apt-get update' + os.EOL +
                    'RUN apt-get install bash jq wget unzip curl -y' + os.EOL;
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
        switch (nconf.get("baseImages:" + algorithmInfos.method.environment)) {
            case "apt":
                content += 'RUN apt-get clean && rm -rf /tmp/* /var/lib/apt/lists/* /var/tmp/* .git' + os.EOL;
                break;
        }

        fs.writeFileSync(outputFolder + path.sep + "Dockerfile", content);
    }

    /**
     * Create the bash script that will be started once the docker image is executed
     *
     * @param {string} identifier
     * @param {any} algorithmInfos
     * @param {outputFolder} outputFolder
     */
    static createBashScript(identifier: string, algorithmInfos: any, outputFolder: string): void {
        let content: string = '#!/bin/bash' + os.EOL;

        //input count starts with 3. Params 1 and 2 are fix used
        // 1: resultResponseUrl
        // 2: errorResponseUrl
        let inputCount: number = 3;

        //check if additional files need to be downloaded
        algorithmInfos.input.forEach((input: any, index: any) => {
            let key = _.keys(algorithmInfos.input[index])[0];
            if (['json', 'file', 'inputFile'].indexOf(key) >= 0) {
                //TODO fix this to use the correct input number of the input image
                content += 'curl -o /data/' + input[key].name + '.' + input[key].options.fileType + ' $' + (inputCount + index) + os.EOL;
                AlgorithmManagement.addRemotePath(identifier, input[key].name, "/data/" + input[key].name + "." + input[key].options.fileType);
                //AlgorithmManagement.addUrlParameter(identifier, input[key].name + "url");
            } else if (key === 'inputImage') {
                content += 'curl -o /data/inputImage.png $' + (inputCount + index) + os.EOL;
            }
        });

        //add the correct execution string
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

        //add all parameters
        algorithmInfos.input.forEach((input: any, index: number) => {
            let key = _.keys(algorithmInfos.input[index])[0];
            let value = ((_.values(algorithmInfos.input[index])[0]) as any).name;
            if (nconf.get("reservedWords").indexOf(key) >= 0 && nconf.get("docker:replacePaths").indexOf(key) >= 0) {
                content += this.getDockerInput(key) + " ";
                inputCount++;
            } else if (nconf.get("reservedWords").indexOf(key) >= 0 && !(nconf.get("docker:replacePaths").indexOf(key) >= 0)) {
                if (AlgorithmManagement.hasRemotePath(identifier, value)) {
                    content += AlgorithmManagement.getRemotePath(identifier, value) + " ";
                }
                inputCount++;
            } else {
                if (key === "highlighter") {
                    content += "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " " + "$" + inputCount++ + " ";
                } else {
                    content += "$" + inputCount + " ";
                    inputCount++;
                }
            }
        });

        //omit the error output stream for matlab, because it behaves weird
        if (algorithmInfos.method.executableType === "matlab") {
            content += '1> /data/result.json' + os.EOL;
        } else {
            content += '1> /data/result.json' + os.EOL;
            //content += '1> /data/result.json 2> /data/error.txt' + os.EOL;
        }
        //add the response sending information
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

    /**
     * Executes a docker image
     * This method makes use of [docker run](@link https://docs.docker.com/engine/reference/run/)
     *
     * @param {Process} process The process to run
     * @param {string} imageName The name of the image to use
     * @param {Function} callback The callback called with an error if one occured
     */
    static runDockerImage(process: Process, imageName: string, callback: Function): void {
        let params = process.parameters.params;
        let neededParams = process.neededParameters;
        //The string passed to the executable containing all parameters
        let executableString = "";

        //get remote path keys
        let remoteKeys = [];
        for (let remote of process.remotePaths) {
            remoteKeys.push(_.keys(remote)[0]);
        }

        //add the actual parameters
        for (let key in params) {
            if (params.hasOwnProperty(key)) {
                let value = params[key];
                if (key === "highlighter") {
                    //handle highlighters
                    executableString += _.map(params.highlighter.split(" "), function (item: any) {
                        return item;
                    }).join(" ");
                } else if (_.find(neededParams, key) != null && ["url"].indexOf(_.find(neededParams, key)[key]) >= 0) {
                    //handle url parameters
                    let originalKey = key.replace("url", "");
                    let originalValue = params[originalKey];
                    let url = "";
                    if (process.hasImages) {
                        url = IoHelper.getStaticImageUrlFull(originalValue);
                    } else {
                        url = IoHelper.getStaticDataUrlFull(originalValue);
                    }
                    executableString += url + ' ';
                } else {
                    //handle regular parameters
                    executableString += value + ' ';
                }
            }
        }

        //build the command
        let command = './script.sh ' + process.remoteResultUrl + ' ' + process.remoteErrorUrl + ' ' + executableString;
        Logger.log("info", command, "DockerManagement");
        //run the docker image (see: https://docs.docker.com/engine/reference/run/)
        this.docker.run(imageName, ['-c', command], process.stdout, { entrypoint: '/bin/sh' }, function (error: any, data: any, container: any) {
            if (data != null) {
                let err = {
                    statusMessage: "Execution did not finish properly! status code is: " + data.statusCode
                };
            }
            if (error != null) {
                Logger.log("error", error, "DockerManagement");
                if (callback != null) {
                    callback(error);
                }
            }
            if (data != null && data.StatusCode === 0) {
                container.remove(function (error: any, data: any) {
                    if (callback != null) {
                        callback(null);
                    }
                });
            } else if (data != null && data.StatusCode !== 0) {
                Logger.log("error", "Execution did not finish properly! status code is: " + data.statusCode, "DockerManagement");
            }

            if (process.type === "test" && data.StatusCode !== 0) {
                AlgorithmManagement.updateStatus(null, "error", process.req.originalUrl, "Algorithm image did not execute properly");
                //ResultHelper.removeResult(process);
                container.remove(function (error: any, data: any) {
                    if (callback != null) {
                        callback(error);
                    }
                });
            }
        });
    }

    /**
     * 
     * @private
     * @static
     * @param {string} input the path that needs to be looked up
     * @returns {string} the path within the docker image
     * 
     * @memberOf DockerManagement
     */
    private static getDockerInput(input: string): string {
        return nconf.get("docker:paths:" + input);
    }
}