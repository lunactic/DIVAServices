/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import * as _ from "lodash";
import * as nconf from "nconf";
import * as fs from "fs";
import {Logger} from "../logging/logger";
import {Process} from "../processingQueue/process";


export class Statistics {
    public static currentExecutions = [];
    public static currentStatistics: any = {};


    static getNumberOfCurrentExecutions(): number {
        return Statistics.currentExecutions.length;
    }

    static isRunning(reqPath: string): boolean {
        let executionInfo = Statistics.currentExecutions.filter(function (x: any) {
            return x.path === reqPath;
        });
        return executionInfo.length > 0;
    }

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

    static endRecording(rand: string, reqPath: string): number {
        Statistics.currentStatistics = JSON.parse(fs.readFileSync(nconf.get("paths:servicesInfoFile"), "utf-8"));
        let executionInfo = Statistics.currentExecutions.filter(function (x: any) {
            return x.rand === rand;
        });
        let endTime = process.hrtime(executionInfo[0].startTime);
        delete Statistics.currentExecutions[rand];

        if (_.find(Statistics.currentStatistics.services, {"path": reqPath}) != null) {
            let stats: any = _.find(Statistics.currentStatistics.services, {"path": reqPath});
            stats = stats.statistics;
            if (stats.executions === 0) {
                stats.executions = 1;
                stats.runtime = endTime[0];
            } else {
                stats.runtime = (stats.runtime + endTime[0]) / 2;
                stats.executions = stats.executions + 1;
            }
        }

        //remove the call from current executions
        Statistics.currentExecutions = Statistics.currentExecutions.filter(function (x: any) {
            return x.rand !== rand;
        });

        fs.writeFileSync(nconf.get("paths:servicesInfoFile"), JSON.stringify(Statistics.currentStatistics, null, "\t"));
        return endTime[0];
    }

    static getMeanExecutionTime(reqPath: string): number {
        if (_.find(Statistics.currentStatistics.services, {"path": reqPath}) != null) {
            let stats: any = _.find(Statistics.currentStatistics.services, {"path": reqPath});
            return stats.statistics.runtime;
        } else {
            return -1;
        }
    }

    static getNumberOfExecutions(reqPath: string): number {
        if (_.find(Statistics.currentStatistics.services, {"path": reqPath}) != null) {
            let stats: any = _.find(Statistics.currentStatistics.services, {"path": reqPath});
            return stats.statistics.executions;
        } else {
            return 0;
        }
    }

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