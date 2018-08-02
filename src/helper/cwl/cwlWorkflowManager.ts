import * as fs from "fs-extra";
import * as _ from "lodash";
import * as os from "os";
import { isNullOrUndefined } from "util";
import { WorkflowInput } from "../../workflows/workflowInput";

export class CwlWorkflowManager {
    private filePath: string;
    private inputs: WorkflowInput[];
    private outputs: Map<string, Map<string, string>>;
    private steps: string[];

    constructor(path: string) {
        this.filePath = path;
        this.inputs = [];
        this.outputs = new Map();
        this.steps = [];
    }

    public initialize() {
        fs.writeFileSync(this.filePath, '#!/usr/bin/env cwl-runner' + os.EOL + os.EOL);
        fs.appendFileSync(this.filePath, 'cwlVersion: v1.0' + os.EOL);
        fs.appendFileSync(this.filePath, 'class: Workflow' + os.EOL);
    }

    public addInput(step: string, type: string, name: string, value?: any) {
        if (!isNullOrUndefined(value)) {
            if (typeof value === "string" && value.startsWith('$')) {
                this.inputs.push(new WorkflowInput(step, type, name, value, null));
            } else {
                this.inputs.push(new WorkflowInput(step, type, name, null, value));
            }
        } else {
            this.inputs.push(new WorkflowInput(step, type, name));
        }
    }

    public addOutput(step: string, type: string, name: string) {
        if (this.outputs.has(step)) {
            let map = this.outputs.get(step);
            map.set(name, type);
            this.outputs.set(step, map);
        } else {
            let map = new Map();
            map.set(name, type);
            this.outputs.set(step, map);
        }
    }

    public addStep(name: string) {
        this.steps.push(name);
    }

    public finalize() {
        fs.appendFileSync(this.filePath, 'inputs:' + os.EOL);
        this.inputs.forEach((input) => {
            if (input.hasReference()) {
                let name = input.getName().split('_')[1];
                fs.appendFileSync(this.filePath, '      ' + name + ': ' + input.getReference() + os.EOL);
            } else if (input.hasDefaultValue()) {
                let name = input.getName().split('_')[1];
                fs.appendFileSync(this.filePath, '      ' + input.getName() + os.EOL);
                fs.appendFileSync(this.filePath, '        default: ' + input.getDefaultValue() + os.EOL);
                fs.appendFileSync(this.filePath, '        type: ' + input.getWfType() + os.EOL);
            } else {
                let name = input.getName().split('_')[1];
                fs.appendFileSync(this.filePath, '      ' + name + ': ' + input.getName() + os.EOL);
            }
        });

        fs.appendFileSync(this.filePath, os.EOL + 'outputs:' + os.EOL);
        this.outputs.forEach((map, step) => {
            map.forEach((value, key) => {
                fs.appendFileSync(this.filePath, '  ' + key + ': ' + os.EOL);
                fs.appendFileSync(this.filePath, '    type: ' + value + os.EOL);
                fs.appendFileSync(this.filePath, '    outputSource: ' + step + '/' + key + os.EOL);
            });
        });

        fs.appendFileSync(this.filePath, os.EOL + 'steps:' + os.EOL);
        this.steps.forEach(step => {
            fs.appendFileSync(this.filePath, '  ' + step + ':' + os.EOL);
            fs.appendFileSync(this.filePath, '    run: ' + step + '.cwl' + os.EOL);
            fs.appendFileSync(this.filePath, '    in:' + os.EOL);
            let inputs = _.filter(this.inputs, { 'step': step });
            inputs.forEach((input: WorkflowInput) => {
                fs.appendFileSync(this.filePath, '      ' + input.getName().split('_')[1] + ': ' + input.getName() + os.EOL);
            });
            fs.appendFileSync(this.filePath, '    out: [');
            let keys = Array.from(this.outputs.get(step).keys());
            fs.appendFileSync(this.filePath, keys.join(', '));
            fs.appendFileSync(this.filePath, ']' + os.EOL);

        });
        //write all steps       
    }
}