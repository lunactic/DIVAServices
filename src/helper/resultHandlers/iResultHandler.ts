import {Process} from "../../processingQueue/process";

/**
 * Result Handler interface
 * @author Marcel Würsch
 */
interface IResultHandler {
    filename: string;
    /**
     * Handles errors
     * @param {any} error The error object
     * @param {Process} process The executed process
     */
    handleError(error: any, process: Process) : void;
    /**
     * Handles results
     * @param {any} error The error object
     * @param {any} stdout The standard output
     * @param {any} stderr The standard error
     * @param {Process} process The executed process
     * @param {Function} callback A callback
     */
    handleResult(error: any, stdout: any, stderr: any, process: Process, callback : Function);
}

export = IResultHandler;