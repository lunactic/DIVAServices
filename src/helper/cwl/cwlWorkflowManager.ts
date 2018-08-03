import * as fs from "fs-extra";
import * as _ from "lodash";
import * as os from "os";
import { isNullOrUndefined } from "util";
import { WorkflowInput } from "../../workflows/workflowInput";
import { WorkflowOutput } from "../../workflows/workflowOutput";

export class CwlWorkflowManager {
    private filePath: string;
    private inputs: WorkflowInput[];
    private outputs: WorkflowOutput[];
    private steps: string[];

    constructor(path: string) {
        this.filePath = path;
        this.inputs = [];
        this.outputs = [];
        this.steps = [];
    }

    public initialize() {
        fs.writeFileSync(this.filePath, '#!/usr/bin/env cwl-runner' + os.EOL + os.EOL);
        fs.appendFileSync(this.filePath, 'cwlVersion: v1.0' + os.EOL);
        fs.appendFileSync(this.filePath, 'class: Workflow' + os.EOL);
    }

    public addInput(step: string, type: string, name: string, infoSpec: any, serviceSpec: any, value?: any) {
        if (!isNullOrUndefined(value)) {
            if (typeof value === "string" && value.startsWith('$')) {
                this.inputs.push(new WorkflowInput(step, type, name, infoSpec, serviceSpec, value, null));
            } else {
                this.inputs.push(new WorkflowInput(step, type, name, infoSpec, serviceSpec, null, value));
            }
        } else {
            this.inputs.push(new WorkflowInput(step, type, name, infoSpec, serviceSpec));
        }
    }

    public addOutput(step: string, type: string, name: string, infoSpec: any) {
        this.outputs.push(new WorkflowOutput(step, name, type, infoSpec));
    }

    public addStep(name: string) {
        this.steps.push(name);
    }

    public finalize() {
        //add inputs
        fs.appendFileSync(this.filePath, 'inputs:' + os.EOL);
        this.inputs.forEach((input) => {
            if (input.hasReference()) {
                return;
            } else if (input.hasDefaultValue()) {
                fs.appendFileSync(this.filePath, '  ' + input.getName() + ':' + os.EOL);
                fs.appendFileSync(this.filePath, '    type: ' + input.getWfType() + os.EOL);
                fs.appendFileSync(this.filePath, '    default: ' + input.getDefaultValue() + os.EOL);
            } else {
                fs.appendFileSync(this.filePath, '  ' + input.getName() + ': ' + input.getWfType() + os.EOL);
            }
        });

        //add outputs
        fs.appendFileSync(this.filePath, os.EOL + 'outputs:' + os.EOL);
        this.outputs.forEach((output) => {
            fs.appendFileSync(this.filePath, '  ' + output.getName() + ': ' + os.EOL);
            fs.appendFileSync(this.filePath, '    type: ' + output.getType() + os.EOL);
            fs.appendFileSync(this.filePath, '    outputSource: ' + output.getStep() + '/' + output.getName() + os.EOL);
        });

        //add steps
        fs.appendFileSync(this.filePath, os.EOL + 'steps:' + os.EOL);
        this.steps.forEach(step => {
            fs.appendFileSync(this.filePath, '  ' + step + ':' + os.EOL);
            fs.appendFileSync(this.filePath, '    run: ' + step + '.cwl' + os.EOL);
            fs.appendFileSync(this.filePath, '    in:' + os.EOL);
            let inputs = _.filter(this.inputs, { 'step': step });
            inputs.forEach((input: WorkflowInput) => {
                if (input.hasReference()) {
                    fs.appendFileSync(this.filePath, '      ' + input.getName().split('_')[1] + ': ' + input.getReference() + os.EOL);
                } else {
                    fs.appendFileSync(this.filePath, '      ' + input.getName().split('_')[1] + ': ' + input.getName() + os.EOL);
                }
            });
            fs.appendFileSync(this.filePath, '    out: [');
            let keys = [];
            let outputs = _.filter(this.outputs, { 'step': step });
            outputs.forEach((output: WorkflowOutput) => {
                keys.push(output.getName());
            });
            fs.appendFileSync(this.filePath, keys.join(', '));
            fs.appendFileSync(this.filePath, ']' + os.EOL);

        });
        //write all steps       
    }

    public getOutputs(): WorkflowOutput[] {
        return this.outputs;
    }

    public getInputs(): WorkflowInput[] {
        return this.inputs;
    }
}