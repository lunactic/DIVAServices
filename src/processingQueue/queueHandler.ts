/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import * as _ from "lodash";
import { Logger } from "../logging/logger";
import { Statistics } from "../statistics/statistics";
import { ProcessingQueue } from "./processingQueue";
import { Process } from "./process";
import { ExecutableHelper } from "../helper/executableHelper";

/**
 * class for handling the different processing queues
 * 
 * @export
 * @class QueueHandler
 */
export class QueueHandler {

    /**
     * queue for local processes
     * 
     * @static
     * @type {ProcessingQueue}
     * @memberOf QueueHandler
     */
    static localProcessingQueue: ProcessingQueue = null;

    /**
     * queue for remote processes 
     * 
     * @static
     * @type {ProcessingQueue}
     * @memberOf QueueHandler
     */
    static remoteProcessingQueue: ProcessingQueue = null;

    /**
     * queue for docker requests
     * 
     * @static
     * @type {ProcessingQueue}
     * @memberOf QueueHandler
     */
    static dockerProcessingQueue: ProcessingQueue = null;

    /**
     * the array of docker jobs currently running
     * 
     * @static
     * @type {Process[]}
     * @memberOf QueueHandler
     */
    static runningDockerJobs: Process[] = null;

    /**
     * the executable helper
     * 
     * @static
     * 
     * @memberOf QueueHandler
     */
    static executableHelper = new ExecutableHelper();

    /**
     * initialize all queues
     * 
     * @static
     * 
     * @memberOf QueueHandler
     */
    static initialize(): void {
        if (QueueHandler.localProcessingQueue === null) {
            QueueHandler.localProcessingQueue = new ProcessingQueue();
        }
        if (QueueHandler.remoteProcessingQueue === null) {
            QueueHandler.remoteProcessingQueue = new ProcessingQueue();
        }
        if (QueueHandler.dockerProcessingQueue === null) {
            QueueHandler.dockerProcessingQueue = new ProcessingQueue();
            QueueHandler.runningDockerJobs = [];
        }

        //TODO add executable helper
    }

    /**
     * add a request to the local queue
     * 
     * @static
     * @param {*} req the incoming POST request
     * 
     * @memberOf QueueHandler
     */
    static async addLocalRequest(req: any): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            let response = await QueueHandler.executableHelper.preprocess(req, QueueHandler.localProcessingQueue, 'regular');
            this.executeLocalRequest();
            resolve(response);
        });
    }

    /**
     * add a request to the remote queue
     * 
     * @static
     * @param {*} req the incoming POST request
     * 
     * @memberOf QueueHandler
     */
    static async addRemoteRequest(req: any): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            let response = await QueueHandler.executableHelper.preprocess(req, QueueHandler.remoteProcessingQueue, 'regular');
            this.executeRemoteRequest();
            resolve(response);
        });

    }

    /**
     * add a request to the docker queue
     * 
     * @static
     * @param {*} req the incoming POST request
     * 
     * @memberOf QueueHandler
     */
    static async addDockerRequest(req: any) {
        return new Promise<any>(async (resolve, reject) => {
            try {
                let response = await QueueHandler.executableHelper.preprocess(req, QueueHandler.dockerProcessingQueue, "regular");
                this.executeDockerRequest();
                resolve(response);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * get the docker job from the queue
     * 
     * @static
     * @param {string} jobId the job-id to retrieve
     * @returns {Process} the process
     * 
     * @memberOf QueueHandler
     */
    static getDockerJob(jobId: string): Process {
        let job = _.find(QueueHandler.runningDockerJobs, { "id": jobId });
        _.remove(QueueHandler.runningDockerJobs, { "id": jobId });
        return job;
    }

    /**
     * check if the docker queue contains a job
     * 
     * @private
     * @static
     * @returns {boolean} true if there is a job in the queue
     * 
     * @memberOf QueueHandler
     */
    private static dockerRequestAvailable(): boolean {
        return QueueHandler.dockerProcessingQueue.getSize() > 0;
    }

    /**
     *  check if the local queue contains a job
     * 
     * @private
     * @static
     * @returns {boolean} true if there is a job in the queue
     * 
     * @memberOf QueueHandler
     */
    private static localRequestAvailable(): boolean {
        return QueueHandler.localProcessingQueue.getSize() > 0;
    }

    /**
     * check if the remote queue contains a job
     * 
     * @private
     * @static
     * @returns {boolean} true if there is a job in the queue
     * 
     * @memberOf QueueHandler
     */
    private static remoteRequestAvailable(): boolean {
        return QueueHandler.remoteProcessingQueue.getSize() > 0;
    }

    /**
     * get the next process from the local queue to execute
     * 
     * @private
     * @static
     * @returns {Process} the process to execute
     * 
     * @memberOf QueueHandler
     */
    private static getNextLocalRequest(): Process {
        return QueueHandler.localProcessingQueue.getNext();
    }

    /**
     * get the next process from the remote queue to execute
     * 
     * @private
     * @static
     * @returns {Process} the process to execute
     * 
     * @memberOf QueueHandler
     */
    private static getNextRemoteRequest(): Process {
        return QueueHandler.remoteProcessingQueue.getNext();
    }

    /**
     * get the next process from the docker queue to execute
     * 
     * @private
     * @static
     * @returns {Process} the process to execute
     * 
     * @memberOf QueueHandler
     */
    private static getNextDockerRequest(): Process {
        return QueueHandler.dockerProcessingQueue.getNext();
    }

    /**
     * execute a process from the docker queue
     * 
     * @private
     * @static
     * 
     * @memberOf QueueHandler
     */
    private static async executeDockerRequest() {
        while (this.dockerRequestAvailable()) {
            Logger.log("info", "execute docker request", "QueueHandler");
            let job = this.getNextDockerRequest();
            QueueHandler.runningDockerJobs.push(job);
            try {
                await ExecutableHelper.executeDockerRequest(job);
            } catch (error) {
                Logger.log("error", error, "QueueHandler");
            }
        }
    }

    /**
     * execute a process from the local queue
     * 
     * @private
     * @static
     * 
     * @memberOf QueueHandler
     */
    private static executeLocalRequest(): void {
        if (Statistics.getNumberOfCurrentExecutions() < 2 && this.localRequestAvailable()) {
            QueueHandler.executableHelper.executeLocalRequest(this.getNextLocalRequest());
        }
    }

    /**
     * execute a process from the remote queue
     * 
     * @private
     * @static
     * 
     * @memberOf QueueHandler
     */
    private static executeRemoteRequest(): void {
        Logger.log("info", "execute remote request", "QueueHandler");
        if (this.remoteRequestAvailable()) {
            QueueHandler.executableHelper.executeRemoteRequest(this.getNextRemoteRequest());
        }
    }
}

