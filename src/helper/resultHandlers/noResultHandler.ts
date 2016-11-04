/**
 * Created by lunactic on 04.11.16.
 */

import * as fs from "fs";
import logger = require("../../logging/logger");
import IResultHandler = require("./iResultHandler");
import Process = require("../../processingQueue/process");
import {IoHelper} from "../ioHelper";

export class NoResultHandler implements IResultHandler {
    filename: string;

    constructor(filename: string) {
        this.filename = filename;
    }

    handleError(error: any, process: Process): void {
        logger.log("error", error, "NoResultHandler");

    }

    handleResult(error: any, stdout: any, stderr: any, process: Process, callback: Function) {
        if (stderr.length > 0) {
            let err = {
                statusCode: 500,
                statusMessage: stderr
            };
            callback(err, null, process.id);
        } else {
            //delete the result file as it is not needed
            IoHelper.deleteFile(this.filename);
            callback(null, null, null);
        }
    }

}