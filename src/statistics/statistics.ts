import * as fs from 'fs';
import * as _ from 'lodash';
import * as nconf from 'nconf';
import * as path from 'path';
import { IoHelper } from '../helper/ioHelper';
import { Logger } from "../logging/logger";
import { Process } from "../processingQueue/process";
/**
 * Created by Marcel Würsch on 02.11.16.
 */
"use strict";


/**
 * class for all statistics
 * 
 * @export
 * @class Statistics
 */
export class Statistics {
    public static currentExecutions = [];
    public static currentStatistics: any = {};

    /**
     * returns the number of currently running local processes
     * 
     * @static
     * @returns {number}
     * 
     * @memberof Statistics
     */
    static getNumberOfCurrentExecutions(): number {
        return Statistics.currentExecutions.length;
    }

    /**
     * check if a process is running for a specific route
     * 
     * @static
     * @param {string} reqPath the request path
     * @returns {boolean} true if a process is running for this route
     * 
     * @memberof Statistics
     */
    static isRunning(reqPath: string): boolean {
        let executionInfo = Statistics.currentExecutions.filter(function (x: any) {
            return x.path === reqPath;
        });
        return executionInfo.length > 0;
    }

    /**
     * get a running process
     * 
     * @static
     * @param {string} rand the random
     * @returns {Process} the process in the statistics
     * 
     * @memberof Statistics
     */
    static getProcess(rand: string): Process {
        let execution = Statistics.currentExecutions.filter(function (x: any) {
            return x.rand === rand;
        });
        if (execution.length > 0) {
            return execution[0].process;
        } else {
            return null;
        }
    }

    /**
     * start time recording for a process
     * 
     * @static
     * @param {Process} proc the process
     * @returns {*} the statistics object
     * 
     * @memberof Statistics
     */
    static startRecording(proc: Process): any {
        let startTime = process.hrtime();
        let rand = Math.random().toString(36).substring(2);
        Statistics.currentExecutions.push({
            rand: rand,
            startTime: startTime,
            path: proc.req.originalUrl,
            process: proc
        });

        return rand;
    }

    /**
     * end the time recording for a process
     * 
     * @static
     * @param {string} rand the random identifier
     * @param {string} reqPath the request path
     * @returns {number} the run time
     * 
     * @memberof Statistics
     */
    static endRecording(rand: string, reqPath: string, startTime: [number, number]): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            Statistics.currentStatistics = JSON.parse(fs.readFileSync(nconf.get("paths:servicesInfoFile"), "utf-8"));
            let endTime = process.hrtime(startTime);
            delete Statistics.currentExecutions[rand];

            if (_.find(Statistics.currentStatistics.services, { "path": reqPath }) != null) {
                let stats: any = _.find(Statistics.currentStatistics.services, { "path": reqPath });
                stats = stats.statistics;
                if (stats.executions === 0) {
                    stats.executions = 1;
                    stats.runtime = endTime[0];
                } else {
                    //compute the new cumulative moving average
                    stats.runtime = ((endTime[0] + (stats.executions * stats.runtime)) / (stats.executions + 1));
                    stats.executions = stats.executions + 1;
                }
            }
            fs.writeFileSync(nconf.get("paths:servicesInfoFile"), JSON.stringify(Statistics.currentStatistics, null, "\t"));
            resolve(endTime[0]);
        });

    }


    static removeActiveExecution(rand: string): [number, number] {
        //remove the call from current executions
        let executionInfo = Statistics.currentExecutions.filter(function (x: any) {
            return x.rand === rand;
        });
        Statistics.currentExecutions = Statistics.currentExecutions.filter(function (x: any) {
            return x.rand !== rand;
        });
        return executionInfo[0].startTime;
    }

    /**
     * get the mean execution time for a method
     * 
     * @static
     * @param {string} reqPath the request path
     * @returns {number} the mean execution time
     * 
     * @memberof Statistics
     */
    static getMeanExecutionTime(reqPath: string): number {
        if (_.find(Statistics.currentStatistics.services, { "path": reqPath }) != null) {
            let stats: any = _.find(Statistics.currentStatistics.services, { "path": reqPath });
            return stats.statistics.runtime;
        } else {
            return -1;
        }
    }

    /**
     * get the number of times a method has been executed
     * 
     * @static
     * @param {string} reqPath the request path
     * @returns {number} the number of times this method has been executed
     * 
     * @memberof Statistics
     */
    static getNumberOfExecutions(reqPath: string): number {
        if (_.find(Statistics.currentStatistics.services, { "path": reqPath }) != null) {
            let stats: any = _.find(Statistics.currentStatistics.services, { "path": reqPath });
            return stats.statistics.executions;
        } else {
            return 0;
        }
    }

    /**
     * record what user used a method
     * 
     * @static
     * @param {Process} proc the invoked process with the information
     * @returns {Promise<void>} 
     * @memberof Statistics
     */
    static async recordUser(proc: Process): Promise<void> {
        let usageLogFile: string = proc.logFolder + path.sep + "usage.log";
        let content = null;
        if (!await IoHelper.fileExists(usageLogFile)) {
            content = {
                users: [
                    {
                        name: proc.identification.name,
                        email: proc.identification.email,
                        country: proc.identification.country,
                        uses: 1
                    }
                ]
            };
        } else {
            content = IoHelper.readFile(usageLogFile);

            let filtered = _.filter(content.users, function (o: any) {
                return o.name === proc.identification.name && o.email === proc.identification.email && o.country === proc.identification.country;
            });

            if (filtered.length > 0) {
                filtered[0].uses = filtered[0].uses + 1;
            } else {
                content.users.push({
                    name: proc.identification.name,
                    email: proc.identification.email,
                    country: proc.identification.country,
                    uses: 1
                });
            }
        }
        return await IoHelper.saveFile(usageLogFile, content, "utf-8");
    }

    /**
     * load all statistics
     * 
     * @static
     * 
     * @memberof Statistics
     */
    static loadStatistics(): void {
        if (Object.keys(Statistics.currentStatistics).length === 0) {
            try {
                Statistics.currentStatistics = JSON.parse(fs.readFileSync(nconf.get("paths:servicesInfoFile"), "utf-8"));
            } catch (error) {
                Logger.log("error", "No statistics file found", "Statistics");
            }
        }
    }
}