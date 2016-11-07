"use strict";
/**
 * Created by lunactic on 07.11.16.
 */

import {Logger} from "../logging/logger";
import * as fs from "fs";
import * as path from "path";
import {Process} from "../processingQueue/process";
let sequest = require("sequest");

export class RemoteExecution {
    serverUrl: string;
    userName: string;

    constructor(serverUrl: string, userName: string) {
        this.serverUrl = serverUrl;
        this.userName = userName;
    }

    uploadFile(localFile: string, remoteFolder: string, callback: Function): void {
        let seq = sequest.connect(this.userName + "@" + this.serverUrl, {readyTimeout: 99999});
        seq("mkdir -p " + remoteFolder, function (error: any, stdout: any) {
            let extension = path.extname(localFile);
            let filename = path.basename(localFile, extension);
            let writer = seq.put(remoteFolder + "/" + filename + extension);
            fs.createReadStream(localFile).pipe(writer);
            writer.on("close", function () {
                callback(null);
            });
        });
    }

    executeCommand(command: string, callback: Function): void {
        let seq = sequest.connect(this.userName + "@" + this.serverUrl, {readyTimeout: 99999});
        seq(command);
        callback(null);
    }

    cleanUp(process: Process): void {
        let seq = sequest.connect(this.userName + "@" + this.serverUrl, {readyTimeout: 99999});
        seq("rm -rf " + process.rootFolder + path.sep);
    }
}