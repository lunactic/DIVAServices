/**
 * Created by Marcel Würsch on 02.11.16.
 */
"use strict";

import * as _ from "lodash";
import { ExecutableHelper } from "../helper/executableHelper";
import { Logger } from "../logging/logger";
import { Statistics } from "../statistics/statistics";
import { Process } from "./process";
import { ProcessingQueue } from "./processingQueue";

/**
 * class for handling the different processing queues
 * 
 * @export
 * @class QueueHandler
 */
export class QueueHandler {

    /**
     * queue for docker requests
     * 
     * @static
     * @type {ProcessingQueue}
     * @memberof QueueHandler
     */
    static dockerProcessingQueue: ProcessingQueue = null;

    /**
     * the array of docker jobs currently running
     * 
     * @static
     * @type {Process[]}
     * @memberof QueueHandler
     */
    static runningDockerJobs: Process[] = null;

    /**
     * the executable helper
     * 
     * @static
     * @memberof QueueHandler
     */
    static executableHelper = new ExecutableHelper();

    /**
     * initialize all queues
     * 
     * @static
     * @memberof QueueHandler
     */
    static initialize(): void {
        if (QueueHandler.dockerProcessingQueue === null) {
            QueueHandler.dockerProcessingQueue = new ProcessingQueue();
            QueueHandler.runningDockerJobs = [];
        }
    }

    /**
     * add a request to the docker queue
     * 
     * @static
     * @param {*} req the incoming POST request
     * @returns {Promise<any>} A JSON object containing the response
     * @memberof QueueHandler
     */
    static addDockerRequest(req: any): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                let response = await QueueHandler.executableHelper.preprocess(req, QueueHandler.dockerProcessingQueue, "regular");
                resolve(response);
            } catch (error) {
                return reject(error);
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
     * @memberof QueueHandler
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
     * @memberof QueueHandler
     */
    private static dockerRequestAvailable(): boolean {
        return QueueHandler.dockerProcessingQueue.getSize() > 0;
    }


    /**
     * get the next process from the docker queue to execute
     * 
     * @private
     * @static
     * @returns {Process} the process to execute
     * @memberof QueueHandler
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
     * @memberof QueueHandler
     */
    static async executeDockerRequest() {
        if (Statistics.getNumberOfCurrentExecutions() < 3 && this.dockerRequestAvailable()) {
            Logger.log("info", "execute docker request", "QueueHandler");
            let job = this.getNextDockerRequest();
            QueueHandler.runningDockerJobs.push(job);
            try {
                await ExecutableHelper.executeDockerRequest(job);
            } catch (error) {
                Logger.log("error", error, "QueueHandler");
            }
            this.executeDockerRequest();
        }
    }
}

