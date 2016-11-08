/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import * as _ from "lodash";
import {Logger}  from "../logging/logger";
import {Statistics} from "../statistics/statistics";
import {ProcessingQueue} from "./processingQueue";
import {Process} from "./process";
import {ExecutableHelper} from "../helper/executableHelper";


export class QueueHandler {

    static localProcessingQueue: ProcessingQueue = null;
    static remoteProcessingQueue: ProcessingQueue = null;
    static dockerProcessingQueue: ProcessingQueue = null;
    static runningDockerJobs: Process[] = null;

    static executableHelper = new ExecutableHelper();

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

    static addLocalRequest(req: any, cb: Function): void {
        let self = this;
        QueueHandler.executableHelper.preprocess(req, QueueHandler.localProcessingQueue, "regular", cb, function () {
            self.executeLocalRequest();
        });
    }

    static addRemoteRequest(req: any, cb: Function): void {
        let self = this;
        QueueHandler.executableHelper.preprocess(req, QueueHandler.remoteProcessingQueue, "regular", cb, function () {
            self.executeRemoteRequest();
        });
    }

    static addDockerRequest(req: any, cb: Function): void {
        let self = this;
        QueueHandler.executableHelper.preprocess(req, QueueHandler.dockerProcessingQueue, "regular", cb, function () {
            self.executeDockerRequest();
        });
    }

    static getDockerJob(jobId: string): Process {
        let job = _.find(QueueHandler.runningDockerJobs, {"id": jobId});
        _.remove(QueueHandler.runningDockerJobs, {"id": jobId});
        return job;
    }

    private static dockerRequestAvailable(): boolean {
        return QueueHandler.dockerProcessingQueue.getSize() > 0;
    }

    private static localRequestAvailable(): boolean {
        return QueueHandler.localProcessingQueue.getSize() > 0;
    }

    private static remoteRequestAvailable(): boolean {
        return QueueHandler.remoteProcessingQueue.getSize() > 0;
    }

    private static getNextLocalRequest(): Process {
        return QueueHandler.localProcessingQueue.getNext();
    }

    private static getNextRemoteRequest(): Process {
        return QueueHandler.remoteProcessingQueue.getNext();
    }

    private static getNextDockerRequest(): Process {
        return QueueHandler.dockerProcessingQueue.getNext();
    }

    private static executeDockerRequest(): void {
        Logger.log("info", "execute docker request", "QueueHandler");
        if (this.dockerRequestAvailable()) {
            let job = this.getNextDockerRequest();
            QueueHandler.runningDockerJobs.push(job);
            //TODO Execute the request
        }
    }

    private static executeLocalRequest(): void {
        if (Statistics.getNumberOfCurrentExecutions() < 2 && this.localRequestAvailable()) {
            QueueHandler.executableHelper.executeLocalRequest(this.getNextLocalRequest());
        }
    }

    private static executeRemoteRequest(): void {
        Logger.log("info", "execute remote request", "QueueHandler");
        if (this.remoteRequestAvailable()) {
            QueueHandler.executableHelper.executeRemoteRequest(this.getNextRemoteRequest());
        }
    }

    //TODO execute local and remote
}

