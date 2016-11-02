import Process = require("../processingQueue/process");
declare class Statistics {
    static currentExecutions: any[];
    static currentStatistics: any;
    static getNumberOfCurrentExecutions(): number;
    static isRunning(reqPath: string): boolean;
    static getProcess(rand: string, reqPath: string): Process;
    static startRecording(reqPath: string, proc: Process): any;
    static endRecording(rand: string, reqPath: string): number;
    static getMeanExecutionTime(reqPath: string): number;
    static loadStatistics(): void;
}
export = Statistics;
