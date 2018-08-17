import * as _ from 'lodash';
import * as nconf from 'nconf';
import * as path from 'path';
import * as url from 'url';
import { isNullOrUndefined } from 'util';
import { CwlWorkflowManager } from '../helper/cwl/cwlWorkflowManager';
import { IoHelper } from "../helper/ioHelper";
import { ServicesInfoHelper } from '../helper/servicesInfoHelper';
import { AlgorithmManagement } from '../management/algorithmManagement';
import { DivaError } from '../models/divaError';
import { WorkflowStep } from './workflowStep';

/**
 * The WorkflowManager provides functionality for creating and managing workflows
 *
 * @export
 * @class WorkflowManager
 */
export class WorkflowManager {
    /**
     * The name of the workflow
     *
     * @private
     * @type {string}
     * @memberof WorkflowManager
     */
    private workflowName: string;


    /**
     * The path to the cwl file of the workflow
     *
     * @private
     * @type {string}
     * @memberof WorkflowManager
     */
    private cwlWorkflowFile: string;

    /**
     * The JSON workflow specification
     *
     * @private
     * @type {*}
     * @memberof WorkflowManager
     */
    private workflow: any;

    /**
     * The workflow manager for the cwl files
     *
     * @private
     * @type {CwlWorkflowManager}
     * @memberof WorkflowManager
     */
    private cwlWorkflowManager: CwlWorkflowManager;

    /**
     * All outputs
     *
     * @private
     * @type {*}
     * @memberof WorkflowManager
     */
    private outputs: any;

    /**
     * All inputs
     *
     * @private
     * @type {*}
     * @memberof WorkflowManager
     */
    private inputs: any;

    /**
     * The workflow folder where all information is stored
     *
     * @private
     * @type {string}
     * @memberof WorkflowManager
     */
    private workflowFolder: string;

    /**
     * The log folder for the workflow
     *
     * @private
     * @type {string}
     * @memberof WorkflowManager
     */
    private logFolder: string;
    /**
     * The folder to store the public information file
     *
     * @private
     * @type {string}
     * @memberof WorkflowManager
     */
    private infoFolder: string;

    /**
     * The 'general' information from the POST request
     *
     * @private
     * @type {*}
     * @memberof WorkflowManager
     */
    private generalInfo: any;

    /**
     * The base route for the generated workflow
     *
     * @private
     * @type {string}
     * @memberof WorkflowManager
     */
    private baseRoute: string;

    /**
     * The version of this workflow
     *
     * @private
     * @type {string}
     * @memberof WorkflowManager
     */
    private version: string;

    /**
     * The complete route for this workflow
     *
     * @private
     * @type {string}
     * @memberof WorkflowManager
     */
    private route: string;

    /**
     * The identifier of this workflow
     *
     * @private
     * @type {string}
     * @memberof WorkflowManager
     */
    private identifier: string;

    /**
     *Creates an instance of WorkflowManager.
     * @param {*} workflowInput the workflow information from the POST request
     * @memberof WorkflowManager
     */
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

            this.cwlWorkflowManager.steps.forEach((step) => {
                step.inputs.forEach((input) => {
                    if (!input.hasDefaultValue() && !input.hasReference()) {
                        if (input.isData) {
                            data.push(input.serviceSpecification);
                            var obj = {};
                            obj[input.name] = Object.keys(input.infoSpecification)[0];
                            paramOrder.push(obj);
                        } else {
                            parameters.push(input.serviceSpecification);
                            var obj = {};
                            obj[input.name] = Object.keys(input.infoSpecification)[0];
                            paramOrder.push(obj);
                        }
                    }
                });
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


    /**
     * Create the public information file for the workflow
     *
     * @returns {Promise<void>} resolves once the information file is created
     * @memberof WorkflowManager
     */
    public createInfoFile(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let info = {
                general: this.generalInfo,
                input: [],
                output: [],
                steps: this.workflow.steps
            };
            this.cwlWorkflowManager.steps.forEach((step) => {
                step.inputs.forEach(input => {
                    if (!input.hasDefaultValue() && !input.hasReference()) {
                        info.input.push(input.infoSpecification);
                    }
                });
            });

            this.cwlWorkflowManager.steps.forEach((step) => {
                step.outputs.forEach(output => {
                    info.output.push(output.infoSpecification);
                });
            });


            await IoHelper.saveFile(this.infoFolder + path.sep + 'info.json', info, 'utf-8');

            resolve();
        });
    }

    /**
     * Update the root information file with the new added workflow
     *
     * @returns {Promise<void>} Resolves once the file is updated
     * @memberof WorkflowManager
     */
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
            try {
                await IoHelper.createFolder(this.workflowFolder);
                await IoHelper.createFolder(this.infoFolder);
                await IoHelper.createFolder(this.logFolder);
                this.cwlWorkflowManager.initialize();
                await this.processSteps(this.workflow.steps);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Process all steps of a workflow
     *
     * @param {*} steps the workflow steps
     * @returns {Promise<void>} resolves onces all steps are processed
     * @memberof WorkflowManager
     */
    public processSteps(steps: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                for (const step of steps) {
                    await this.processStep(step);
                }
                this.cwlWorkflowManager.finalize();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Process a single step
     *
     * @param {*} step the step to process
     * @returns {Promise<void>} resolves onces the step is processed
     * @memberof WorkflowManager
     */
    public processStep(step: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let wfStep: WorkflowStep = new WorkflowStep(step);
                this.cwlWorkflowManager.addStep(wfStep);
                switch (step.type) {
                    case 'regular':
                        await this.processRegular(wfStep);
                        resolve();
                        break;
                    default:
                        break;
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Process a regular step 
     *
     * @static
     * @param {WorkflowStep} step the step information
     * @returns {Promise<void>}
     * @memberof WorkflowManager
     */
    public processRegular(step: WorkflowStep): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
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
                            this.cwlWorkflowManager.addOutput(step, 'File', output[outputType].name, output);
                            break;
                    }
                });

                //copy-the workflow file
                IoHelper.copyFile(service.cwl, this.workflowFolder + path.sep + step.name + '.cwl');
                resolve();
            } catch (error) {
                switch (error.errorType) {
                    case 'MethodNotFound':
                        reject(new DivaError("Could not create workflow, because method: " + step.method + " does not exist.", 500, "WorkflowCreationError"));
                        break;
                }
            }
        });
    }

    /**
     * add an input to the workflow cwl file
     *
     * @private
     * @param {WorkflowStep} step the step to attach this input to
     * @param {string} name the name of the input
     * @param {*} infoSpec the public JSON specification
     * @param {*} serviceSpec the internal JSON specification
     * @param {string} type the type of the input
     * @memberof WorkflowManager
     */
    private addValue(step: WorkflowStep, name: string, infoSpec: any, serviceSpec: any, type: string) {
        let dataValue = _.find(step.stepDefinition.inputs.data, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
        let paramValue = step.stepDefinition.inputs.parameters[infoSpec[Object.keys(infoSpec)[0]].name];

        if (!isNullOrUndefined(dataValue)) {
            let reference = dataValue[infoSpec[Object.keys(infoSpec)[0]].name];
            this.cwlWorkflowManager.addInput(step, type, name, infoSpec, serviceSpec, reference);
        } else if (!isNullOrUndefined(paramValue)) {
            this.cwlWorkflowManager.addInput(step, type, name, infoSpec, serviceSpec, paramValue);

        } else {
            this.cwlWorkflowManager.addInput(step, type, name, infoSpec, serviceSpec);
        }
    }
}