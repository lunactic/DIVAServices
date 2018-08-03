import { isNullOrUndefined } from "util";

export class WorkflowInput {
    private step: string;
    private wfType: string;
    private name: string;
    private reference: string;
    private defaultValue: any;
    private infoSpecification: any;
    private serviceSpecification: any;
    private isData: boolean;

    constructor(step: string, wfType: string, name: string, infoSpecification: any, serviceSpecification: any, reference?: string, defaultValue?: any) {
        this.step = step;
        this.wfType = wfType;
        if (wfType === 'File' || wfType === 'Directory') {
            this.isData = true;
        } else {
            this.isData = false;
        }
        this.name = name;
        if (!isNullOrUndefined(reference)) {
            this.reference = reference.replace(/\$/g, '');
        }
        this.infoSpecification = infoSpecification;
        this.infoSpecification[Object.keys(this.infoSpecification)[0]].name = this.name;
        this.serviceSpecification = serviceSpecification;
        this.serviceSpecification[this.name] = this.serviceSpecification[name.split('_')[1]];
        delete this.serviceSpecification[name.split('_')[1]];
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

    public getInfoSpecification() {
        return this.infoSpecification;
    }

    public getServiceSpecification() {
        return this.serviceSpecification;
    }

    public isDataInput(): boolean {
        return this.isData;
    }

    public hasReference(): boolean {
        return !isNullOrUndefined(this.reference);
    }

    public hasDefaultValue(): boolean {
        return !isNullOrUndefined(this.defaultValue);
    }
}
