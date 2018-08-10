import * as _ from 'lodash';
import * as nconf from 'nconf';
import * as path from 'path';
import * as url from 'url';
import { isNullOrUndefined } from 'util';
import { CwlWorkflowManager } from '../helper/cwl/cwlWorkflowManager';
import { IoHelper } from "../helper/ioHelper";
import { ServicesInfoHelper } from '../helper/servicesInfoHelper';
import { AlgorithmManagement } from '../management/algorithmManagement';
export class WorkflowManager {
    private workflowName: string;
    private cwlWorkflowFile: string;
    private workflow: any;
    private cwlWorkflowManager: CwlWorkflowManager;
    private outputs: any;
    private inputs: any;

    private workflowFolder: string;
    private logFolder: string;
    private infoFolder: string;

    private generalInfo: any;

    private baseRoute: string;
    private version: string;
    private route: string;
    private identifier: string;

    constructor(workflowInput: any) {
        this.workflow = workflowInput.workflow;
        this.workflowName = this.workflow.name;

        this.baseRoute = 'workflows/' + this.workflowName.toLowerCase();
        this.version = '1';
        this.route = this.baseRoute + '/' + this.version;
        this.identifier = AlgorithmManagement.createIdentifier();

        this.workflowFolder = nconf.get("paths:workflowsPath") + path.sep + this.workflowName.toLowerCase() + path.sep + this.version;
        this.cwlWorkflowFile = this.workflowFolder + path.sep + this.workflowName + '.cwl';
        this.cwlWorkflowManager = new CwlWorkflowManager(this.cwlWorkflowFile);

        this.infoFolder = nconf.get('paths:jsonPath') + path.sep + 'workflows' + path.sep + this.workflowName.toLowerCase() + path.sep + this.version;
        this.generalInfo = workflowInput.general;
        this.logFolder = nconf.get('paths:logPath') + path.sep + this.route;
    }


    /**
     * Create the entry in the services.json file
     *
     * @returns {Promise<void>}
     * @memberof WorkflowManager
     */
    public createServicesEntry(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await ServicesInfoHelper.reload();
            let newContent = _.cloneDeep(ServicesInfoHelper.fileContent);

            let parameters = [];
            let data = [];
            let paramOrder = [];

            this.cwlWorkflowManager.getInputs().forEach((input) => {
                if (!input.hasDefaultValue() && !input.hasReference()) {
                    if (input.isDataInput()) {
                        data.push(input.getServiceSpecification());
                        var obj = {};
                        obj[input.getName()] = Object.keys(input.getInfoSpecification())[0];
                        paramOrder.push(obj);
                    } else {
                        parameters.push(input.getServiceSpecification());
                        var obj = {};
                        obj[input.getName()] = Object.keys(input.getInfoSpecification())[0];
                        paramOrder.push(obj);
                    }
                }
            });

            let newServiceEntry = {
                name: this.workflowName,
                service: this.route.replace(/\//g, '').toLowerCase(),
                baseRoute: '/' + this.baseRoute,
                identifier: this.identifier,
                path: '/' + this.route,
                cwl: nconf.get('paths:rootPath') + path.sep + this.route + path.sep + this.workflowName + '.cwl',
                executablePath: '',
                output: 'file',
                execute: 'docker',
                noCache: false,
                rewriteRules: [],
                executableType: 'workflow',
                imageName: '',
                parameters: parameters,
                data: data,
                paramOrder: paramOrder,
                remotePaths: [],
                version: this.version,
                status: {
                    statusCode: 200,
                    statusMessage: "This workflow is available"
                },
                statistics: {
                    runtime: -1,
                    executions: 0
                },
                exceptions: []
            };
            newContent.services.push(newServiceEntry);
            ServicesInfoHelper.update(newContent);
            await ServicesInfoHelper.reload();
            resolve();
        });
    }


    public createInfoFile(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let info = {
                general: this.generalInfo,
                input: [],
                output: [],
                steps: this.workflow.steps
            };

            this.cwlWorkflowManager.getInputs().forEach(input => {
                if (!input.hasDefaultValue() && !input.hasReference()) {
                    info.input.push(input.getInfoSpecification());
                }
            });

            this.cwlWorkflowManager.getOutputs().forEach(output => {
                info.output.push(output.getInfoSpecification());
            });

            await IoHelper.saveFile(this.infoFolder + path.sep + 'info.json', info, 'utf-8');

            resolve();
        });
    }

    public updateRootFile(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let info = {
                general: this.generalInfo
            };
            await AlgorithmManagement.updateRootInfoFile(info, this.route);
            resolve();
        });
    }

    /**
     * Parse a workflow Json and create the CWL file
     *
     * @returns {Promise<void>}
     * @memberof WorkflowManager
     */
    public parseWorkflow(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await IoHelper.createFolder(this.workflowFolder);
            await IoHelper.createFolder(this.infoFolder);
            await IoHelper.createFolder(this.logFolder);
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
            this.inputs = IoHelper.readFile(nconf.get('paths:jsonPath') + service.path + path.sep + 'info.json').input;
            //process inputs
            this.inputs.forEach(input => {
                switch (Object.keys(input)[0]) {
                    case 'resultFile':
                        var name: string = step.name + '_resultFile';
                        var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === input[Object.keys(input)[0]].name; });
                        this.addValue(step, name, input, serviceSpec, 'string');
                        break;
                    case 'file':
                        var name: string = step.name + '_' + input[Object.keys(input)[0]].name;
                        var serviceSpec = _.find(service.data, function (o: any) { return Object.keys(o)[0] === input[Object.keys(input)[0]].name; });
                        this.addValue(step, name, input, serviceSpec, 'File');
                        break;
                    case 'folder':
                        var name: string = step.name + '_' + input[Object.keys(input)[0]].name;
                        var serviceSpec = _.find(service.data, function (o: any) { return Object.keys(o)[0] === input[Object.keys(input)[0]].name; });
                        this.addValue(step, name, input, serviceSpec, 'Directory');
                        break;
                    case 'text':
                        var name: string = step.name + '_' + input[Object.keys(input)[0]].name;
                        var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === input[Object.keys(input)[0]].name; });
                        this.addValue(step, name, input, serviceSpec, 'string');
                        break;
                    case 'number':
                        var name: string = step.name + '_' + input[Object.keys(input)[0]].name;
                        var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === input[Object.keys(input)[0]].name; });
                        this.addValue(step, name, input, serviceSpec, 'float');
                        break;
                    case 'select':
                        var name: string = step.name + '_' + input[Object.keys(input)[0]].name;
                        var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === input[Object.keys(input)[0]].name; });
                        this.addValue(step, name, input, serviceSpec, 'string');
                        break;
                    case 'mcr2014b':
                        var name: string = step.name + "_mcr2014b";
                        var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === input[Object.keys(input)[0]].name; });
                        this.addValue(step, name, input, serviceSpec, 'string');
                        break;
                    case 'outputFolder':
                        var name: string = step.name + "_outputFolder";
                        var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === Object.keys(input)[0]; });
                        this.addValue(step, name, input, serviceSpec, 'string');
                        break;
                    case 'highlighter':
                        var name: string = "highlighter";
                        switch (input.highlighter.type) {
                            case 'rectangle':
                                for (var recIndex = 0; recIndex < 8; recIndex++) {
                                    var name = step.name + "_highlighter" + String(recIndex);
                                    this.addValue(step, name, input, {}, 'float');
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
                        this.cwlWorkflowManager.addOutput(step.name, 'File', output[outputType].name, output);
                        break;
                }
            });

            //copy-the workflow file
            IoHelper.copyFile(service.cwl, this.workflowFolder + path.sep + step.name + '.cwl');
            resolve();
        });
    }

    private addValue(step: any, name: string, infoSpec: any, serviceSpec: any, type: string) {
        let dataValue = _.find(step.inputs.data, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
        let paramValue = step.inputs.parameters[infoSpec[Object.keys(infoSpec)[0]].name];

        if (!isNullOrUndefined(dataValue)) {
            let reference = dataValue[infoSpec[Object.keys(infoSpec)[0]].name];
            this.cwlWorkflowManager.addInput(step.name, type, name, infoSpec, serviceSpec, reference);
        } else if (!isNullOrUndefined(paramValue)) {
            this.cwlWorkflowManager.addInput(step.name, type, name, infoSpec, serviceSpec, paramValue);

        } else {
            this.cwlWorkflowManager.addInput(step.name, type, name, infoSpec, serviceSpec);
        }
    }
}