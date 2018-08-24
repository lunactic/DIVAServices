import * as fs from "fs-extra";
import * as os from "os";
import { isNullOrUndefined } from "util";
import { DivaError } from "../../models/divaError";
import { FileTypeChecker } from "../../workflows/typecheckers/fileTypeChecker";
import { ITypeChecker } from "../../workflows/typecheckers/iTypeChecker";
import { NumberTypeChecker } from "../../workflows/typecheckers/numberTypeChecker";
import { WorkflowInput } from "../../workflows/workflowInput";
import { WorkflowOutput } from "../../workflows/workflowOutput";
import { WorkflowStep } from "../../workflows/workflowStep";
import { WorkflowWarning } from "../../workflows/workflowWarning";
import _ = require("lodash");

export class CwlWorkflowManager {
    private filePath: string;
    private _steps: WorkflowStep[];

    constructor(path: string) {
        this.filePath = path;
        this._steps = [];
    }

    public initialize() {
        fs.writeFileSync(this.filePath, '#!/usr/bin/env cwl-runner' + os.EOL + os.EOL);
        fs.appendFileSync(this.filePath, 'cwlVersion: v1.0' + os.EOL);
        fs.appendFileSync(this.filePath, 'class: Workflow' + os.EOL);
    }

    public async addInput(step: WorkflowStep, type: string, name: string, infoSpec: any, serviceSpec: any, warnings: WorkflowWarning[], value?: any): Promise<void> {
        if (!isNullOrUndefined(value)) {
            if (typeof value === "string" && value.startsWith('$')) {
                //TODO Check the output reference from the referenced step
                let input: WorkflowInput = new WorkflowInput(type, name, infoSpec, serviceSpec, value, null);
                let outputStepName: string = value.split('/')[0].replace('$', '');
                let outputStepOutput: string = value.split('/')[1].replace('$', '');
                let outputStep: WorkflowStep = this.getStep(outputStepName);
                if (isNullOrUndefined(outputStep)) {
                    Promise.reject(new DivaError("Input: " + input.name + "  references to step: " + outputStepName + " which does not exist", 500, "WorkflowCreationError"));
                    return;
                }
                let output: WorkflowOutput = outputStep.getOutput(outputStepOutput);
                if (isNullOrUndefined(output)) {
                    Promise.reject(new DivaError("Input: " + input.name + " references to output: " + outputStepOutput + " from step: " + outputStepName + " which does not exist", 500, "WorkflowCreationError"));
                    return;
                }
                try {
                    await this.checkReference(input, output, warnings);
                    step.addInput(input);
                    Promise.resolve();
                } catch (error) {
                    Promise.reject(error);
                    return;
                }
                Promise.resolve();
                return;
            } else {
                step.addInput(new WorkflowInput(type, name, infoSpec, serviceSpec, null, value));
                Promise.resolve();
                return;
            }
        } else {
            step.addInput(new WorkflowInput(type, name, infoSpec, serviceSpec));
            Promise.resolve();
        }
    }


    public addOutput(step: WorkflowStep, type: string, name: string, infoSpec: any) {
        step.addOutput(new WorkflowOutput(name, type, infoSpec));
    }

    public addStep(step: WorkflowStep) {
        this.steps.push(step);
    }

    public finalize() {
        //add inputs
        fs.appendFileSync(this.filePath, 'inputs:' + os.EOL);
        for (let step of this.steps) {
            for (let input of step.inputs) {
                if (input.hasReference()) {
                    continue;
                } else if (input.hasDefaultValue()) {
                    fs.appendFileSync(this.filePath, '  ' + input.name + ':' + os.EOL);
                    fs.appendFileSync(this.filePath, '    type: ' + input.wfType + os.EOL);
                    fs.appendFileSync(this.filePath, '    default: ' + input.defaultValue + os.EOL);
                } else {
                    fs.appendFileSync(this.filePath, '  ' + input.name + ': ' + input.wfType + os.EOL);
                }
            }
        }


        //add outputs
        fs.appendFileSync(this.filePath, os.EOL + 'outputs:' + os.EOL);
        for (let step of this.steps) {
            for (let output of step.outputs) {
                fs.appendFileSync(this.filePath, '  ' + step.name + '_' + output.name + ': ' + os.EOL);
                fs.appendFileSync(this.filePath, '    type: ' + output.wfType + os.EOL);
                fs.appendFileSync(this.filePath, '    outputSource: ' + step.name + '/' + output.name + os.EOL);
            }
        }


        //add steps
        fs.appendFileSync(this.filePath, os.EOL + 'steps:' + os.EOL);
        for (let step of this.steps) {
            fs.appendFileSync(this.filePath, '  ' + step.name + ':' + os.EOL);
            fs.appendFileSync(this.filePath, '    run: ' + step.name + '.cwl' + os.EOL);
            fs.appendFileSync(this.filePath, '    in:' + os.EOL);
            for (let input of step.inputs) {
                if (input.hasReference()) {
                    fs.appendFileSync(this.filePath, '      ' + input.name.split('_')[1] + ': ' + input.reference + os.EOL);
                } else {
                    fs.appendFileSync(this.filePath, '      ' + input.name.split('_')[1] + ': ' + input.name + os.EOL);
                }
            }
            fs.appendFileSync(this.filePath, '    out: [');
            let keys = [];
            for (let output of step.outputs) {
                keys.push(output.name);
            }
            fs.appendFileSync(this.filePath, keys.join(', '));
            fs.appendFileSync(this.filePath, ']' + os.EOL);

        }
        //write all steps       
    }

    public get steps(): WorkflowStep[] {
        return this._steps;
    }

    public getStep(name: string): WorkflowStep {
        return _.find(this.steps, { 'name': name });
    }

    private async checkReference(input: WorkflowInput, output: WorkflowOutput, warnings: WorkflowWarning[]): Promise<void> {
        //TODO: Allow Reference Checking to return a list of "warnings". 
        //These warnings can be used for things that might work but are not guaranteed
        try {
            if (input.wfType !== output.wfType) {
                Promise.reject(new DivaError("Input: " + input.name + " and Output: " + output.name + " do not have the same type and can therefore not be matched", 500, "WorkflowCreationError"));
                return;
            } else {
                let typeChecker: ITypeChecker;
                switch (input.wfType) {
                    case 'File':
                        typeChecker = new FileTypeChecker();
                        return await typeChecker.checkType(input, output, warnings);
                    case 'float':
                        typeChecker = new NumberTypeChecker();
                        return await typeChecker.checkType(input, output, warnings);
                    case 'string':
                        break;
                    case 'Directory':
                        break;
                }
            }
        } catch (error) {
            Promise.reject(error);
            return;
        }
    }
}