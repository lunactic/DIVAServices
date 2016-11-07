import {Process} from "../../processingQueue/process";
/**
 * Created by lunactic on 04.11.16.
 */

interface IResultHandler {
    filename: string;
    handleError(error: any, process: Process) : void;
    handleResult(error: any, stdout: any, stderr: any, process: Process, callback : Function);
}

export = IResultHandler;