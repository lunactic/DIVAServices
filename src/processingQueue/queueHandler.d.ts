import ProcessingQueue = require("./processingQueue");
import Process = require("./process");
declare class QueueHandler {
    static localProcessingQueue: ProcessingQueue;
    static remoteProcessingQueue: ProcessingQueue;
    static dockerProcessingQueue: ProcessingQueue;
    static runningDockerJobs: Process[];
    static initialize(): void;
    static addLocalRequest(req: any, cb: void): void;
    static addRemoteRequest(req: any, cb: void): void;
    static addDockerRequest(req: any, cb: void): void;
    static getDockerJob(jobId: string): Object;
    private dockerRequestAvailable();
    private localRequestAvailable();
    private remoteRequestAvailable();
    private getNextLocalRequest();
    private getNextRemoteRequest();
    private getNextDockerRequest();
    private executeDockerRequest();
}
export = QueueHandler;
