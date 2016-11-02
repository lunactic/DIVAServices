/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import * as _ from "lodash";

import logger = require("../logging/logger");
import Statistics = require("../statistics/statistics");
import ProcessingQueue = require("./processingQueue");
import Process = require("./process");


class QueueHandler {

    static localProcessingQueue: ProcessingQueue = null;
    static remoteProcessingQueue: ProcessingQueue = null;
    static dockerProcessingQueue: ProcessingQueue = null;
    static runningDockerJobs: Process[] = null;

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

    static addLocalRequest(req: any, cb: void): void {
        //TODO complete
    }

    static addRemoteRequest(req: any, cb: void): void {
        //TODO complete
    }

    static addDockerRequest(req: any, cb: void): void {
        //TODO complete
    }

    static getDockerJob(jobId: string): Object {
        let job = _.find(QueueHandler.runningDockerJobs, {"id": jobId});
        _.remove(QueueHandler.runningDockerJobs, {"id": jobId});
        return job;
    }

    private dockerRequestAvailable(): boolean {
        return QueueHandler.dockerProcessingQueue.getSize() > 0;
    }

    private localRequestAvailable(): boolean {
        return QueueHandler.localProcessingQueue.getSize() > 0;
    }

    private remoteRequestAvailable(): boolean {
        return QueueHandler.remoteProcessingQueue.getSize() > 0;
    }

    private getNextLocalRequest(): Process {
        return QueueHandler.localProcessingQueue.getNext();
    }

    private getNextRemoteRequest(): Process {
        return QueueHandler.remoteProcessingQueue.getNext();
    }

    private getNextDockerRequest(): Process {
        return QueueHandler.dockerProcessingQueue.getNext();
    }

    private executeDockerRequest(): void {
        logger.log("info", "execute docker request", "QueueHandler");
        if (this.dockerRequestAvailable()) {
            let job = this.getNextDockerRequest();
            QueueHandler.runningDockerJobs.push(job);
            //TODO Execute the request
        }
    }

    //TODO execute local and remote
}


export = QueueHandler;