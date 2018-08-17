import * as fs from "fs-extra";
import * as os from "os";
import { isNullOrUndefined } from "util";
import { WorkflowInput } from "../../workflows/workflowInput";
import { WorkflowOutput } from "../../workflows/workflowOutput";
import { WorkflowStep } from "../../workflows/workflowStep";

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

    public addInput(step: WorkflowStep, type: string, name: string, infoSpec: any, serviceSpec: any, value?: any) {
        if (!isNullOrUndefined(value)) {
            if (typeof value === "string" && value.startsWith('$')) {
                step.addInput(new WorkflowInput(type, name, infoSpec, serviceSpec, value, null));
            } else {
                step.addInput(new WorkflowInput(type, name, infoSpec, serviceSpec, null, value));
            }
        } else {
            step.addInput(new WorkflowInput(type, name, infoSpec, serviceSpec));
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
        this.steps.forEach((step) => {
            step.inputs.forEach((input) => {
                if (input.hasReference()) {
                    return;
                } else if (input.hasDefaultValue()) {
                    fs.appendFileSync(this.filePath, '  ' + input.name + ':' + os.EOL);
                    fs.appendFileSync(this.filePath, '    type: ' + input.wfType + os.EOL);
                    fs.appendFileSync(this.filePath, '    default: ' + input.defaultValue + os.EOL);
                } else {
                    fs.appendFileSync(this.filePath, '  ' + input.name + ': ' + input.wfType + os.EOL);
                }
            });
        });


        //add outputs
        fs.appendFileSync(this.filePath, os.EOL + 'outputs:' + os.EOL);
        this.steps.forEach((step) => {
            step.outputs.forEach((output) => {
                fs.appendFileSync(this.filePath, '  ' + output.name + ': ' + os.EOL);
                fs.appendFileSync(this.filePath, '    type: ' + output.wfType + os.EOL);
                fs.appendFileSync(this.filePath, '    outputSource: ' + step.name + '/' + output.name + os.EOL);
            });
        });


        //add steps
        fs.appendFileSync(this.filePath, os.EOL + 'steps:' + os.EOL);
        this.steps.forEach(step => {
            fs.appendFileSync(this.filePath, '  ' + step + ':' + os.EOL);
            fs.appendFileSync(this.filePath, '    run: ' + step + '.cwl' + os.EOL);
            fs.appendFileSync(this.filePath, '    in:' + os.EOL);
            step.inputs.forEach((input: WorkflowInput) => {
                if (input.hasReference()) {
                    fs.appendFileSync(this.filePath, '      ' + input.name.split('_')[1] + ': ' + input.reference + os.EOL);
                } else {
                    fs.appendFileSync(this.filePath, '      ' + input.name.split('_')[1] + ': ' + input.name + os.EOL);
                }
            });
            fs.appendFileSync(this.filePath, '    out: [');
            let keys = [];
            step.outputs.forEach((output: WorkflowOutput) => {
                keys.push(output.name);
            });
            fs.appendFileSync(this.filePath, keys.join(', '));
            fs.appendFileSync(this.filePath, ']' + os.EOL);

        });
        //write all steps       
    }

    public get steps(): WorkflowStep[] {
        return this._steps;
    }
}