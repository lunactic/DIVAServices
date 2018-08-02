import * as _ from 'lodash';
import * as nconf from 'nconf';
import * as path from 'path';
import * as url from 'url';
import { isNullOrUndefined } from 'util';
import { CwlWorkflowManager } from '../helper/cwl/cwlWorkflowManager';
import { IoHelper } from "../helper/ioHelper";
import { ServicesInfoHelper } from '../helper/servicesInfoHelper';
export class WorkflowManager {
    private workflowName: string;
    private workflowFolder: string;
    private cwlWorkflowFile: string;
    private workflow: any;
    private cwlWorkflowManager: CwlWorkflowManager;
    private outputs: any;
    /**
         * Pseudo Code
         *  - Generate a workflow identifier
         *  - Generate a workflow folder
         *  - Parse Json into CWL file
         * 
         */


    constructor(workflowInput: any) {
        this.workflow = workflowInput.workflow;
        this.workflowName = this.workflow.name;
        this.workflowFolder = nconf.get("paths:workflowsPath") + path.sep + this.workflowName;
        this.cwlWorkflowFile = this.workflowFolder + path.sep + this.workflowName + '.cwl';
        this.cwlWorkflowManager = new CwlWorkflowManager(this.cwlWorkflowFile);

    }

    /**
     * Parse a workflow Json and create the CWL file
     *
     * @returns {Promise<void>}
     * @memberof WorkflowManager
     */
    public parseWorkflow(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            IoHelper.createFolder(this.workflowFolder);
            //create workflow file
            this.cwlWorkflowManager.initialize();
            await this.processSteps(this.workflow.steps);
            resolve();
        });
    }

    public processSteps(steps: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            for (const step of steps) {
                await this.processStep(step);
                this.cwlWorkflowManager.addStep(step.name);
            }
            this.cwlWorkflowManager.finalize();
            resolve();
        });
    }

    public processStep(step: any): Promise<void> {
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

    /**
     * Process a regular step 
     *
     * @static
     * @param {*} step the step information
     * @param {string} workflowFolder the current workflow folder
     * @returns {Promise<void>}
     * @memberof WorkflowManager
     */
    public processRegular(step: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let uri = new url.URL(step.method);
            //TODO fix the replace part
            let service = await ServicesInfoHelper.getInfoByPath(uri.pathname.replace(nconf.get('server:rootUrl'), ""));
            this.outputs = IoHelper.readFile(nconf.get('paths:jsonPath') + service.path + path.sep + 'info.json').output;

            //process inputs
            service.paramOrder.forEach(param => {
                switch (Object.values(param)[0]) {
                    case 'resultFile':
                        var name: string = step.name + '_resultFile';
                        this.addValue(step, name, param, 'string');
                        break;
                    case 'file':
                        var name: string = step.name + '_' + Object.keys(param)[0];
                        this.addValue(step, name, param, 'File');
                        break;
                    case 'folder':
                        var name: string = step.name + '_' + Object.keys(param)[0];
                        this.cwlWorkflowManager.addInput(step.name, 'Directory', name);
                        break;
                    case 'text':
                        var name: string = step.name + '_' + Object.keys(param)[0];
                        this.addValue(step, name, param, 'string');
                        break;
                    case 'number':
                        var name: string = step.name + '_' + Object.keys(param)[0];
                        this.addValue(step, name, param, 'float');
                        break;
                    case 'select':
                        var name: string = step.name + '_' + Object.keys(param)[0];
                        this.addValue(step, name, param, 'string');
                        break;
                    case 'mcr2014b':
                        var name: string = step.name + "_mcr2014b";
                        this.addValue(step, name, param, 'string');
                        break;
                    case 'outputFolder':
                        var name: string = step.name + "_outputFolder";
                        this.addValue(step, name, param, 'string');
                        break;
                    case 'highlighter':
                        var name: string = "highlighter";
                        switch (param.highlighter.type) {
                            case 'rectangle':
                                for (var recIndex = 0; recIndex < 8; recIndex++) {
                                    var name = step.name + "_highlighter" + String(recIndex);
                                    this.addValue(step, name, param, 'float');
                                }
                                break;
                        }
                        break;
                }
            });

            //process outputs
            this.outputs.forEach(output => {
                let outputType = Object.keys(output)[0];
                switch (outputType) {
                    case 'file':
                        this.cwlWorkflowManager.addOutput(step.name, 'File', output[outputType].name);
                        break;
                }
            });

            //copy-the workflow file
            IoHelper.copyFile(service.cwl, this.workflowFolder + path.sep + step.name + '.cwl');
            resolve();
        });
    }

    private addValue(step: any, name: string, param: any, type: string) {
        let dataValue = _.find(step.inputs.data, function (o: any) { return Object.keys(o)[0] === Object.keys(param)[0]; });
        let paramValue = step.inputs.parameters[Object.keys(param)[0]];

        if (!isNullOrUndefined(dataValue)) {
            let reference = dataValue[Object.keys(param)[0]];
            this.cwlWorkflowManager.addInput(step.name, type, name, reference);
        } else if (!isNullOrUndefined(paramValue)) {
            this.cwlWorkflowManager.addInput(step.name, type, name, paramValue);

        } else {
            this.cwlWorkflowManager.addInput(step.name, type, name);
        }
    }
}