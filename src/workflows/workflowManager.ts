import * as nconf from 'nconf';
import * as path from 'path';
import { IoHelper } from "../helper/ioHelper";
import { DivaError } from "../models/divaError";

export class WorkflowManager {

    /**
     * Parse a workflow Json and create the CWL file
     *
     * @returns {Promise<void>}
     * @memberof WorkflowManager
     */
    public static parseWorkflow(workflowInput: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if ('workflow' in workflowInput) {
                let workflow = workflowInput.workflow;
                /**
                 * Pseudo Code
                 *  - Generate a workflow identifier
                 *  - Generate a workflow folder
                 *  - Parse Json into CWL file
                 * 
                 */
                let workflowName = workflow.name;
                IoHelper.createFolder(nconf.get("paths:workflowsPath") + path.sep + workflowName);
                await this.processSteps(workflow.steps);
                resolve();
            } else {
                reject(new DivaError("Incorrect Workflow JSON Format", 500, "WrongWorkflowJson"));
            }
            resolve();
        });
    }

    public static processSteps(steps: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            for (const step of steps) {
                await this.processStep(step);
            }
            resolve();
        });
    }

    public static processStep(step: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            switch (step.type) {
                case 'regular':
                    await this.processRegular(step);
                    resolve();
                    break;

                default:
                    break;
            }
        });
    }

    public static processRegular(step: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log('I am a regular step');
            resolve();
        });
    }
}