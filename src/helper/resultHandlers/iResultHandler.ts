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
     */
    handleResult(error: any, stdout: any, stderr: any, process: Process) : Promise<any>;

    /**
     * Handle cwltool results
     * 
     * @param {Process} process the executed process 
     * @returns {Promise<any>} 
     * @memberof IResultHandler
     */
    handleCwlResult(process: Process): Promise<any>;
}

export = IResultHandler;