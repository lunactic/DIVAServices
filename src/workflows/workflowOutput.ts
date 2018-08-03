export class WorkflowOutput {

    private step: string;
    private name: string;
    private wfType: string;
    private infoSpecification: any;


    constructor(step: string, name: string, type: string, infoSpec: any) {
        this.step = step;
        this.name = name;
        this.wfType = type;
        this.infoSpecification = infoSpec;
    }


    public getStep(): string {
        return this.step;
    }

    public getName(): string {
        return this.name;
    }

    public getType(): string {
        return this.wfType;
    }

    public getInfoSpecification(): string {
        return this.infoSpecification;
    }
}