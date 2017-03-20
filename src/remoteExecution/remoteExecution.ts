"use strict";
/**
 * Created by lunactic on 07.11.16.
 */

import { Logger } from "../logging/logger";
import * as fs from "fs";
import * as path from "path";
import { Process } from "../processingQueue/process";
let sequest = require("sequest");

/**
 * class designed to handle executions on a Sun Grid Engine
 * 
 * @export
 * @class RemoteExecution
 */
export class RemoteExecution {
    serverUrl: string;
    userName: string;

    constructor(serverUrl: string, userName: string) {
        this.serverUrl = serverUrl;
        this.userName = userName;
    }

    /**
     * upload a file to the cluster
     * 
     * @param {string} localFile the local file path
     * @param {string} remoteFolder the remote folder
     * 
     * @memberOf RemoteExecution
     */
    uploadFile(localFile: string, remoteFolder: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let seq = sequest.connect(this.userName + "@" + this.serverUrl, { readyTimeout: 99999 });
            seq("mkdir -p " + remoteFolder, function (error: any, stdout: any) {
                let extension = path.extname(localFile);
                let filename = path.basename(localFile, extension);
                let writer = seq.put(remoteFolder + "/" + filename + extension);
                fs.createReadStream(localFile).pipe(writer);
                writer.on("close", function () {
                    resolve();
                });
            });
        });
    }

    /**
     * execute a command over ssh
     * 
     * @param {string} command the command to execute
     * @param {Function} callback the callback function
     * 
     * @memberOf RemoteExecution
     */
    executeCommand(command: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let seq = sequest.connect(this.userName + "@" + this.serverUrl, { readyTimeout: 99999 });
            seq(command);
            resolve();
        });

    }

    /**
     * clean up after execution (remove the folder)
     * 
     * @param {Process} process the process to clean up for
     * 
     * @memberOf RemoteExecution
     */
    cleanUp(process: Process): void {
        let seq = sequest.connect(this.userName + "@" + this.serverUrl, { readyTimeout: 99999 });
        seq("rm -rf " + process.rootFolder + path.sep);
    }
}