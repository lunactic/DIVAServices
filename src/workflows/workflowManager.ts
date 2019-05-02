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
import { WorkflowWarning } from './workflowWarning';

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
     * The warnings generated during the creation process of this workflow
     * 
     * @private
     * @type {WorkflowWarning[]}
     * @memberof WorkflowManager
     */
    private warnings: WorkflowWarning[];

    /**
     *Creates an instance of WorkflowManager.
     * @param {*} workflowInput the workflow information from the POST request
     * @memberof WorkflowManager
     */
    constructor(workflowInput: any) {
        this.workflow = workflowInput.workflow;
        this.workflowName = this.workflow.name;
        this.warnings = [];
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
    public async createServicesEntry(): Promise<void> {
        await ServicesInfoHelper.reload();
        let newContent = _.cloneDeep(ServicesInfoHelper.fileContent);

        let parameters = [];
        let data = [];
        let paramOrder = [];

        for (let step of this.cwlWorkflowManager.steps) {
            for (let input of step.inputs) {
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
            }
        }


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
        return await ServicesInfoHelper.reload();
    }


    /**
     * Create the public information file for the workflow
     *
     * @returns {Promise<void>} resolves once the information file is created
     * @memberof WorkflowManager
     */
    public async createInfoFile(): Promise<void> {
        let info = {
            general: this.generalInfo,
            input: [],
            output: [],
            steps: this.workflow.steps
        };
        for (let step of this.cwlWorkflowManager.steps) {
            for (let input of step.inputs) {
                if (!input.hasDefaultValue() && !input.hasReference()) {
                    info.input.push(input.infoSpecification);
                }
            }
            for (let output of step.outputs) {
                info.output.push(output.infoSpecification);
            }
        }

        return await IoHelper.saveFile(this.infoFolder + path.sep + 'info.json', info, 'utf-8');

    }

    /**
     * Update the root information file with the new added workflow
     *
     * @returns {Promise<void>} Resolves once the file is updated
     * @memberof WorkflowManager
     */
    public async updateRootFile(): Promise<void> {
        let info = {
            general: this.generalInfo
        };
        return await AlgorithmManagement.updateRootInfoFile(info, this.route);
    }

    /**
     * Parse a workflow Json and create the CWL file
     *
     * @returns {Promise<WorkflowWarning[]>}
     * @memberof WorkflowManager
     */
    public parseWorkflow(): Promise<WorkflowWarning[]> {
        return new Promise<WorkflowWarning[]>(async (resolve, reject) => {
            try {
                await IoHelper.createFolder(this.workflowFolder);
                await IoHelper.createFolder(this.infoFolder);
                await IoHelper.createFolder(this.logFolder);
                this.cwlWorkflowManager.initialize();
                await this.processSteps(this.workflow.steps);
                resolve(this.warnings);
            } catch (error) {
                reject(error);
                return;
            }
        });
    }

    /**
     * Process all steps of a workflow
     *
     * @param {*} steps the workflow steps
     * @memberof WorkflowManager
     */
    public async processSteps(steps: any) {
        try {
            for (const step of steps) {
                await this.processStep(step);
            }
            this.cwlWorkflowManager.finalize();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process a single step
     *
     * @param {*} step the step to process
     * @memberof WorkflowManager
     */
    public async processStep(step: any) {
        try {
            let wfStep: WorkflowStep = new WorkflowStep(step);
            this.cwlWorkflowManager.addStep(wfStep);
            switch (step.type) {
                case 'regular':
                    return await this.processRegular(wfStep);
                case "builtIn":
                    switch (step.method) {
                        case 'picker':
                            return await this.processPicker(wfStep);
                        // case 'foreach':
                        
                    }
                    // ..builtIn/picker/picker.cwl
                    // return await this.processPicker(wfStep):
                    // add Input / Outputs to cwlWorkflowManager (hardcoded)
                    // create YAML File
                default:
                    break;
            }
        } catch (error) {
            throw error;
        }
    }

    public processPicker(step: WorkflowStep): Promise<void>{
        return new Promise<void>(async (resolve, reject) => {
            for (let infoSpec of this.inputs) {
                // dataValue should be '$lineSegmentation/$textLines'
                let dataValue = step.stepDefinition.inputs.data[0].input;
                //paramValue should be the regexp
                let paramValue = step.stepDefinition.inputs.parameters.regex;

                // add the two input values (collection and regex)
                await this.addValue(step, step.name + '_inputCollection', {}, {}, 'Directory', dataValue, null);
                await this.addValue(step, step.name + '_regex', {}, {}, 'string', null, paramValue);
                
                // create the output
                let output = this.outputs[0];
                this.cwlWorkflowManager.addOutput(step, 'File', output['file'].name, output);

                // copy-the workflow file
                IoHelper.copyFile('../builtInFunctions/cwl/picker.cwl', this.workflowFolder + path.sep + step.name + '.cwl');            
                resolve();
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
    public processRegular(step: WorkflowStep): Promise < void> {
    return new Promise<void>(async (resolve, reject) => {
        try {
            let uri = new url.URL(step.method);
            //TODO fix the replace part
            let service = await ServicesInfoHelper.getInfoByPath(uri.pathname.replace(nconf.get('server:rootUrl'), ""));
            this.outputs = IoHelper.readFile(nconf.get('paths:jsonPath') + service.path + path.sep + 'info.json').output;
            this.inputs = IoHelper.readFile(nconf.get('paths:jsonPath') + service.path + path.sep + 'info.json').input;
            //process inputs
            for (let infoSpec of this.inputs) {
                let dataValue = _.find(step.stepDefinition.inputs.data, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
                let paramValue = step.stepDefinition.inputs.parameters[infoSpec[Object.keys(infoSpec)[0]].name];
                try {
                    switch (Object.keys(infoSpec)[0]) {
                        case 'resultFile':
                            var name: string = step.name + '_resultFile';
                            var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
                            await this.addValue(step, name, infoSpec, serviceSpec, 'string', dataValue, paramValue);
                            break;
                        case 'file':
                            var name: string = step.name + '_' + infoSpec[Object.keys(infoSpec)[0]].name;
                            var serviceSpec = _.find(service.data, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
                            await this.addValue(step, name, infoSpec, serviceSpec, 'File', dataValue, paramValue);
                            break;
                        case 'folder':
                            var name: string = step.name + '_' + infoSpec[Object.keys(infoSpec)[0]].name;
                            var serviceSpec = _.find(service.data, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
                            await this.addValue(step, name, infoSpec, serviceSpec, 'Directory', dataValue, paramValue);
                            break;
                        case 'text':
                            var name: string = step.name + '_' + infoSpec[Object.keys(infoSpec)[0]].name;
                            var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
                            await this.addValue(step, name, infoSpec, serviceSpec, 'string', dataValue, paramValue);
                            break;
                        case 'number':
                            var name: string = step.name + '_' + infoSpec[Object.keys(infoSpec)[0]].name;
                            var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
                            //check if provided default value is valid
                            if (paramValue !== null && paramValue !== undefined) {
                                if (infoSpec.number.options.min !== null || infoSpec.number.options.min !== undefined) {
                                    if (paramValue < infoSpec.number.options.min) {
                                        reject(new DivaError("Trying to set default value for input: " + name + " to:  " + paramValue + " which is smaller than the allowed minimum", 500, "WorkflowCreationError"));
                                        return;
                                    }
                                }
                                if (infoSpec.number.options.max !== null || infoSpec.number.options.max !== undefined) {
                                    if (paramValue > infoSpec.number.options.max) {
                                        reject(new DivaError("Trying to set default value for input: " + name + " to:  " + paramValue + " which is larger than the allowed minimum", 500, "WorkflowCreationError"));
                                        return;
                                    }
                                }
                            }
                            await this.addValue(step, name, infoSpec, serviceSpec, 'float', dataValue, paramValue);
                            break;
                        case 'select':
                            var name: string = step.name + '_' + infoSpec[Object.keys(infoSpec)[0]].name;
                            var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
                            //check if provided default value is valid
                            if (paramValue !== null && paramValue !== undefined) {
                                if (!infoSpec.select.options.values.includes(paramValue)) {
                                    reject(new DivaError("Trying to set default value for input: " + name + " to: " + paramValue + " which is not in the list of possible values", 500, "WorkflowCreationError"));
                                    return;
                                }
                            }
                            await this.addValue(step, name, infoSpec, serviceSpec, 'string', dataValue, paramValue);
                            break;
                        case 'mcr2014b':
                            var name: string = step.name + "_mcr2014b";
                            var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === infoSpec[Object.keys(infoSpec)[0]].name; });
                            await this.addValue(step, name, infoSpec, serviceSpec, 'string', dataValue, paramValue);
                            break;
                        case 'outputFolder':
                            var name: string = step.name + "_outputFolder";
                            var serviceSpec = _.find(service.parameters, function (o: any) { return Object.keys(o)[0] === Object.keys(infoSpec)[0]; });
                            await this.addValue(step, name, infoSpec, serviceSpec, 'string', dataValue, paramValue);
                            break;
                        case 'highlighter':
                            var name: string = "highlighter";
                            switch (infoSpec.highlighter.type) {
                                case 'rectangle':
                                    for (var recIndex = 0; recIndex < 8; recIndex++) {
                                        var name = step.name + "_highlighter" + String(recIndex);
                                        await this.addValue(step, name, infoSpec, {}, 'float', dataValue, paramValue);
                                    }
                                    break;
                            }
                            break;
                    }
                } catch (error) {
                    reject(error);
                    return;
                }
            }

            //process outputs
            for (let output of this.outputs) {
                let outputType = Object.keys(output)[0];
                switch (outputType) {
                    case 'file':
                        this.cwlWorkflowManager.addOutput(step, 'File', output[outputType].name, output);
                        break;
                    case 'folder':
                        this.cwlWorkflowManager.addOutput(step, 'Directory', output[outputType].name, output)
                        break;
                }
            }

            //copy-the workflow file
            IoHelper.copyFile(service.cwl, this.workflowFolder + path.sep + step.name + '.cwl');
            resolve();
        } catch (error) {
            switch (error.errorType) {
                case 'MethodNotFound':
                    reject(new DivaError("Could not create workflow, because method: " + step.method + " does not exist.", 500, "WorkflowCreationError"));
                    return;
                default:
                    reject(error);
                    return;
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
     * @param {*} dataValue the provided default value (if existing)
     * @param {*} paramValue the provided parameter value (if existing)
     * @memberof WorkflowManager
     */
    private async addValue(step: WorkflowStep, name: string, infoSpec: any, serviceSpec: any, type: string, dataValue: any, paramValue: any) {
    try {
        if (!isNullOrUndefined(dataValue)) {
            //if picker don't create a new reference, just pass on the dataValue
            let reference = dataValue[infoSpec[Object.keys(infoSpec)[0]].name];
            await this.cwlWorkflowManager.addInput(step, type, name, infoSpec, serviceSpec, this.warnings, reference);
        } else if (!isNullOrUndefined(paramValue)) {
            await this.cwlWorkflowManager.addInput(step, type, name, infoSpec, serviceSpec, this.warnings, paramValue);
        } else {
            await this.cwlWorkflowManager.addInput(step, type, name, infoSpec, serviceSpec, this.warnings);
        }
    } catch (error) {
        throw error;
    }
}
}