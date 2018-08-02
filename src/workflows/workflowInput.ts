import { isNullOrUndefined } from "util";

export class WorkflowInput {
    private step: string;
    private wfType: string;
    private name: string;
    private reference: string;
    private defaultValue: any;

    constructor(step: string, wfType: string, name: string, reference?: string, defaultValue?: any) {
        this.step = step;
        this.wfType = wfType;
        this.name = name;
        if (!isNullOrUndefined(reference)) {
            this.reference = reference.replace(/\$/g, '');
        }

        this.defaultValue = defaultValue;
    }


    public getStep(): string {
        return this.step;
    }

    public getWfType(): string {
        return this.wfType;
    }

    public getName(): string {
        return this.name;
    }

    public getReference() {
        return this.reference;
    }

    public getDefaultValue() {
        return this.defaultValue;
    }

    public hasReference(): boolean {
        return !isNullOrUndefined(this.reference);
    }

    public hasDefaultValue(): boolean {
        return !isNullOrUndefined(this.defaultValue);
    }
}
