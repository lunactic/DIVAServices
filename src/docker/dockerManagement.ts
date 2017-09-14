import { IoHelper } from '../helper/ioHelper';
import { DivaCollection } from '../models/divaCollection';
/**
 * Created by Marcel Würsch on 04.11.16.
 */

import * as _ from 'lodash';
import { AlgorithmManagement } from "../management/algorithmManagement";
import * as archiver from 'archiver';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as nconf from 'nconf';
import * as path from 'path';
import * as DOCKER from 'dockerode';
import * as mime from 'mime';
import { Logger } from "../logging/logger";
import { DivaFile } from '../models/divaFile';
import * as os from 'os';
import { Process } from "../processingQueue/process";
import { DivaError } from "../models/divaError";
import * as stream from 'stream';
import * as ssh from 'ssh2';
import { YamlManager } from "../helper/cwl/yamlManager";

var Client = require('ssh2').Client;

/**
 * A class for managing, and running docker images
 */
export class DockerManagement {
    /**
     * The Docker communication object
     */
    static docker = null;
    /**
     * Create a new image
     * 
     * @param {string} inputFolder The folder where the container contents are stored
     * @param {string} imageName The name of the image to create
     */
    static buildImage(inputFolder: string, imageName: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            //create tar file
            if (this.docker == null) {
                this.initDocker();
            }
            let output = fse.createWriteStream(inputFolder + path.sep + "archive.tar");
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
                                return reject(new DivaError(errorMessage, 500, "DockerError"));
                            }
                            try {
                                let json = JSON.parse(data.toString());
                                let id = json.stream.split(":")[1].replace(os.EOL, "");
                                Logger.log("trace", "built new image with id: " + id, "DockerManagement");
                            } catch (error) {
                                hasError = true;
                                return reject(new DivaError(data.toString(), 500, "DockerError"));
                            }
                        });
                        response.on("end", function () {
                            if (!hasError) {
                                Logger.log("info", "successfully build the image", "DockerManagement");
                                resolve(id);
                            }
                        });
                    }
                });
            });
            //build an archive of the current contents of the inputFolder
            archive.pipe(output);

            archive.directory(inputFolder + path.sep, false);
            //build the archive --> this will trigger the "close" handler
            archive.finalize();
        });


    }


    /**
     * Remove an image from the docker server
     * @param {String} imageName the name of the image to remove
     */
    static removeImage(imageName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.docker == null) {
                this.initDocker();
            }
            this.docker.getImage(imageName).remove(function (err: any, data: any) {
                if (err != null) {
                    Logger.log("error", err, "DockerManagement");
                    return reject(new DivaError(err.message, 500, "DockerError"));
                }
                resolve();
            });
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
                content += 'RUN addgroup -S ' + nconf.get("docker:group") + os.EOL;
                content += 'RUN adduser -S -g ' + nconf.get("docker:group") + ' ' + nconf.get("docker:user") + os.EOL;
                content += 'RUN apk update' + os.EOL +
                    'RUN apk add curl bash nano' + os.EOL;
                break;
            case "apt":
                content += 'RUN groupadd ' + nconf.get("docker:group") + os.EOL;
                content += 'RUN useradd --create-home --home-dir $HOME -g ' + nconf.get("docker:group") + ' ' + nconf.get("docker:user") + os.EOL;
                content += 'RUN apt-get update' + os.EOL +
                    'RUN apt-get install bash jq wget unzip curl nano -y' + os.EOL;
                break;
        }

        content += 'RUN mkdir -p /output' + os.EOL +
            'RUN mkdir -p /input' + os.EOL +
            'COPY . /input' + os.EOL +
            'RUN unzip /input/algorithm.zip -d /input' + os.EOL +
            'RUN chown -R ' + nconf.get("docker:group") + ':' + nconf.get("docker:user") + ' /input' + os.EOL;

        switch (nconf.get("baseImages:" + algorithmInfos.method.environment)) {
            case "apt":
                content += 'RUN apt-get clean && rm -rf /tmp/* /var/lib/apt/lists/* /var/tmp/* .git' + os.EOL;
                break;
        }
        content += 'WORKDIR /input' + os.EOL;
        content += 'RUN chmod +x *' + os.EOL;
        content += 'USER ' + nconf.get("docker:user") + ':' + nconf.get("docker:group") + os.EOL;
        content += 'CMD ["/input/script.sh"]';
        fse.writeFileSync(outputFolder + path.sep + "Dockerfile", content);
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
        content += 'echo ' + os.EOL;
        content += 'echo ------------------' + os.EOL;
        content += 'echo BEGINNING OF DIVASERVICES LOG RECORDING' + os.EOL;
        content += 'echo ------------------' + os.EOL;

        let inputCount: number = 1;

        //check if additional files need to be downloaded
        let index = 0;
        for (let input of algorithmInfos.input) {
            let key = _.keys(algorithmInfos.input[index])[0];
            if (['json', 'file', 'inputFile'].indexOf(key) >= 0) {
                content += String((inputCount + index)) + '=$' + (inputCount + index) + os.EOL;
                content += 'curl -vs -o /data/' + input[key].name + '.' + mime.extension(input[key].options.mimeType) + ' $' + (inputCount + index) + " 2>/dev/null" + os.EOL;
                content += input[key].name + '="${' + (inputCount + index) + '##*/}"' + os.EOL;
                content += 'mv /data/' + input[key].name + '.' + mime.extension(input[key].options.mimeType) + ' /data/$' + input[key].name + os.EOL;
                content += 'echo ' + input[key].name + ' is using file: ' + '$' + (inputCount + index) + os.EOL;
                AlgorithmManagement.addRemotePath(identifier, input[key].name, "/data/$" + input[key].name);
            } else if (['folder'].indexOf(key) >= 0) {
                content += 'curl -vs -o /data/' + input[key].name + '.zip' + ' $' + (inputCount + index) + " 2>/dev/null" + os.EOL;
                content += 'echo ' + input[key].name + ' is using file: ' + '$' + (inputCount + index) + os.EOL;
                AlgorithmManagement.addRemotePath(identifier, input[key].name, "/data/" + input[key].name + "/");
            }
            index++;
        }
        index = 0;
        //check for unzipping
        for (let input of algorithmInfos.input) {
            let key = _.keys(algorithmInfos.input[index])[0];
            if (['folder'].indexOf(key) >= 0) {
                content += 'unzip /input/' + input[key].name + '.zip' + ' -d /input/' + input[key].name + os.EOL;
            }
            index++;
        }

        //add the correct execution string
        switch (algorithmInfos.method.executableType) {
            case "java":
                content += 'java -Djava.awt.headless=true -Xmx4096m -jar /input/' + algorithmInfos.method.executable_path + ' ';
                break;
            case "bash":
            case "matlab":
                content += '/input/' + algorithmInfos.method.executable_path + ' ';
                break;
        }

        //add all parameters
        index = 0;
        for (let input of algorithmInfos.input) {
            let key = _.keys(algorithmInfos.input[index])[0];
            let value = ((_.values(algorithmInfos.input[index])[0]) as any).name;
            if (nconf.get("reservedWords").indexOf(key) >= 0 && !(nconf.get("docker:replacePaths").indexOf(key) >= 0)) {
                if (AlgorithmManagement.hasRemotePath(identifier, value)) {
                    content += AlgorithmManagement.getRemotePath(identifier, value) + " ";
                } else if (key === "highlighter") {
                    content += "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} ";
                } else {
                    content += "${" + inputCount + "} ";
                }
                inputCount++;
            } else {
                if (key === "highlighter") {
                    content += "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} ";
                } else {
                    content += "${" + inputCount + "} ";
                    inputCount++;
                }
            }
            index++;
        }
        content += os.EOL;
        //add the response sending information
        content += 'if [ -s "/output/error.txt" ]' + os.EOL;
        content += 'then' + os.EOL;
        content += '    curl -vs -H "Content-Type: text/plain" --data @/output/error.txt $2' + " 2>/dev/null" + os.EOL;
        content += 'fi' + os.EOL;
        content += 'if [ -s "/output/result.json" ]' + os.EOL;
        content += 'then' + os.EOL;
        content += '    curl -vs -H "Content-Type: application/json" --data @/data/result.json $1' + " 2>/dev/null" + os.EOL;
        content += 'fi' + os.EOL;
        content += 'echo ------------------' + os.EOL;
        content += 'echo END OF DIVASERVICES LOG RECORDING' + os.EOL;
        content += 'echo ------------------' + os.EOL;
        fse.writeFileSync(outputFolder + path.sep + "script.sh", content);
    }

    /**
     * 
     * 
     * @static
     * @param {string} identifier 
     * @param {*} algorithmInfos 
     * @param {string} outputFolder 
     * @memberof DockerManagement
     */
    static createCwlBashScript(identifier: string, algorithmInfos: any, outputFolder: string): void {
        let content: string = '#!/bin/bash' + os.EOL;
        content += 'echo ' + os.EOL;
        content += 'echo ------------------' + os.EOL;
        content += 'echo BEGINNING OF DIVASERVICES LOG RECORDING' + os.EOL;
        content += 'echo ------------------' + os.EOL;

        let inputCount: number = 1;

        //check if additional files need to be downloaded
        let index = 0;

        //add the correct execution string
        switch (algorithmInfos.method.executableType) {
            case "java":
                content += 'java -Djava.awt.headless=true -Xmx4096m -jar /input/' + algorithmInfos.method.executable_path + ' ';
                break;
            case "bash":
            case "matlab":
                content += '/input/' + algorithmInfos.method.executable_path + ' ';
                break;
        }

        //add all parameters
        index = 0;
        for (let input of algorithmInfos.input) {
            let key = _.keys(algorithmInfos.input[index])[0];
            let value = ((_.values(algorithmInfos.input[index])[0]) as any).name;
            if (nconf.get("reservedWords").indexOf(key) >= 0 && !(nconf.get("docker:replacePaths").indexOf(key) >= 0)) {
                if (AlgorithmManagement.hasRemotePath(identifier, value)) {
                    content += AlgorithmManagement.getRemotePath(identifier, value) + " ";
                } else if (key === "highlighter") {
                    content += "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} ";
                } else {
                    content += "${" + inputCount + "} ";
                }
                inputCount++;
            } else {
                if (key === "highlighter") {
                    content += "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} " + "${" + inputCount++ + "} ";
                } else {
                    content += "${" + inputCount + "} ";
                    inputCount++;
                }
            }
            index++;
        }
        content += os.EOL;
        fse.writeFileSync(outputFolder + path.sep + "script.sh", content);
    }

    /**
     * Executes a docker image
     * This method makes use of [docker run](@link https://docs.docker.com/engine/reference/run/)
     *
     * @param {Process} process The process to run
     * @param {string} imageName The name of the image to use
     */
    static runDockerImage(process: Process, imageName: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this.docker == null) {
                this.initDocker();
            }
            let params = process.matchedParameters;
            //The string passed to the executable containing all parameters
            let executableString = "";

            //get remote path keys
            let remoteKeys = [];
            for (let remote of process.remotePaths) {
                remoteKeys.push(_.keys(remote)[0]);
            }

            //add the actual parameters
            for (let param of params) {
                let key = _.keys(param)[0];
                let value = param[key];
                if (key === "highlighter") {
                    //handle highlighters
                    executableString += _.map(value.split(" "), function (item: any) {
                        return item;
                    }).join(" ");
                    executableString += " ";
                } else if (value instanceof DivaFile) {
                    //handle data parameters
                    executableString += (value as DivaFile).url + ' ';
                } else if (value instanceof DivaCollection) {
                    executableString += (value as DivaCollection).zipUrl + ' ';
                } else {
                    //handle regular parameters
                    executableString += value + ' ';
                }
            }


            //build the command
            let command = './script.sh ' + process.remoteResultUrl + ' ' + process.remoteErrorUrl + ' ' + executableString;
            Logger.log("info", command, "DockerManagement");
            //run the docker image (see: https://docs.docker.com/engine/reference/run/)
            let container = null;
            try {
                var logStream: stream.Writable = new stream.Writable();
                var errLogStream: stream.Writable = new stream.Writable();
                var logFileStream = fse.createWriteStream(process.stdLogFile);
                var errFileStream = fse.createWriteStream(process.errLogFile);

                logStream._write = function (chunk: any, encoding: string, callback: Function) {
                    logFileStream.write(chunk.toString('utf8'));
                    callback();
                };

                errLogStream._write = function (chunk: any, encoding: string, callback: Function) {
                    errFileStream.write(chunk.toString('utf8'));
                    callback();
                };

                let container: DOCKER.Container = await this.docker.run(imageName, ['-c', command], [logStream, errLogStream], { Tty: false, entrypoint: '/bin/sh', Memory: (nconf.get("docker:maxMemory") * 1024 * 1024) }, null);

                if (container.output.StatusCode !== 0) {
                    AlgorithmManagement.recordException(process.algorithmIdentifier, IoHelper.readFile(process.errLogFile));
                    throw new Error("error processing the request");
                }
                if (process.type === "test" && container.output.StatusCode !== 0) {
                    AlgorithmManagement.updateStatus(null, "error", process.req.originalUrl, "Algorithm image did not execute properly");
                    //ResultHelper.removeResult(process);
                }
                let stats: fse.Stats = await fse.stat(process.errLogFile);
                if (stats.size === 0) {
                    IoHelper.deleteFile(process.errLogFile);
                }
                await container.remove({ "volumes": true });
                resolve();
            } catch (error) {
                Logger.log("error", error, "DockerManagement");
                if (container != null) {
                    await container.remove({ "volumes": true });
                }
                return reject(new DivaError(error.message, 500, "DockerError"));
            }
        });
    }

    static runDockerImageSSH(process: Process, imageName: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            var yamlManager: YamlManager = new YamlManager(process.yamlFile);
            var conn: ssh.Client = new Client();
            conn.on('ready', () => {
                Logger.log("debug", "Client :: ready", "DockerManagement::runDockerImageSSH");
                let params = process.matchedParameters;
                //create job.yaml file
                for (let param of params) {
                    let key = _.keys(param)[0];
                    let value = param[key];
                    if (key === "highlighter") {
                        //TODO: add handler for arrays
                    } else if (value instanceof DivaFile) {
                        yamlManager.addInputValue(key, "file", (value as DivaFile).path);
                    } else if (value instanceof DivaCollection) {
                        if (process.type === 'test') {
                            yamlManager.addInputValue(key, 'directory', (value as DivaCollection).folder);
                        } else {
                            yamlManager.addInputValue(key, 'directory', (value as DivaCollection).folder + 'original/');
                        }
                    } else {
                        //handle regular parameters
                        if (key === "resultFile") {
                            yamlManager.addInputValue(key, "string", "/output/" + process.tmpResultFile.split("/").pop());
                        } else {
                            yamlManager.addInputValue(key, "string", value);
                        }
                    }
                }

                var command: string = "cwltool --outdir " + process.outputFolder
                    + " --debug "
                    + "--tmp-outdir-prefix /data/output/ "
                    + "--tmpdir-prefix /data/tmp/ "
                    + "--docker-user " + nconf.get("docker:user") + " "
                    + "--workdir /input "
                    + process.cwlFile
                    + " "
                    + process.yamlFile;
                Logger.log("debug", command, "DockerManagement::runDockerImageSSH");

                //TODO Fix this once it is known how to properly fetch logs from cwltool
                var errStream = fs.createWriteStream(process.errLogFile);
                var outStream = fs.createWriteStream(process.stdLogFile);
                var cwlStream = fs.createWriteStream(process.cwlLogFile);

                conn.exec(command, (err: Error, stream: ssh.ClientChannel) => {
                    if (err) {
                        reject(new DivaError("Error executing the Workflow", 500, "ExecutionError"));
                    }
                    stream.on('close', async (code, signal) => {
                        if (code !== 0) {
                            //error in execution
                            Logger.log("error", "Error executing the workflow", "DockerManagement::runDockerImageSSH");
                            await process.resultHandler.handleCwlError(process);
                            reject(new DivaError("Error executing the Workflow", 500, "ExecutionError"));
                        } else {
                            await process.resultHandler.handleCwlResult(process);
                            resolve();
                        }
                        //Logger.log("debug", "Stream :: close :: code: " + code + ", signal: " + signal, "DockerManagement::runDockerImageSSH");
                    }).on('keyboard-interactive', (name, instruction, instructionsLang, prompts, finish) => {
                        Logger.log("debug", "Connection :: keyboard-interactive", "DockerManagement::runDockerImageSSH");
                        finish([nconf.get("docker:sshPass")]);
                    }).on('data', (data) => {
                        outStream.write(data);
                        Logger.log("debug", "STDOUT: " + data, "DockerManagement::runDockerImageSSH");
                    }).stderr.on('data', (data) => {
                        if (data.toString().startsWith('[job')) {
                            cwlStream.write(data);
                            Logger.log("debug", "JOBLOG: " + data, "DockerManagement::runDockerImageSSH");
                        } else {
                            errStream.write(data);
                            Logger.log("error", "STDERR: " + data, "DockerManagement::runDockerImageSSH");
                        }
                    });
                });
            }).connect({
                host: nconf.get("docker:host"),
                port: 22,
                username: nconf.get("docker:sshUser"),
                password: nconf.get("docker:sshPass"),
                forceIPv4: true,
                tryKeyboard: true
            });
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

    private static initDocker() {
        this.docker = new DOCKER({ host: nconf.get("docker:host"), port: nconf.get("docker:port") });
    }
}