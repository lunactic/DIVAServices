/**
 * Output of a workflow
 *
 * @export
 * @class WorkflowOutput
 */
export class WorkflowOutput {

    /**
     * The name of the workflow output
     *
     * @private
     * @type {string}
     * @memberof WorkflowOutput
     */
    private _name: string;

    /**
     * The type of the output
     *
     * @private
     * @type {string}
     * @memberof WorkflowOutput
     */
    private _wfType: string;


    /**
     * The JSON specification of the output in the original method
     *
     * @private
     * @type {*}
     * @memberof WorkflowOutput
     */
    private _infoSpecification: any;


    /**
     *Creates an instance of WorkflowOutput.

     * @param {string} name the name of the output
     * @param {string} type the type of the output
     * @param {*} infoSpec the original JSON specification of the output
     * @memberof WorkflowOutput
     */
    constructor(name: string, type: string, infoSpec: any) {
        this.name = name;
        this.wfType = type;
        this.infoSpecification = infoSpec;
    }

    get name(): string {
        return this._name;
    }
    set name(name: string) {
        this._name = name;
    }

    get wfType(): string {
        return this._wfType;
    }

    set wfType(wfType: string) {
        this._wfType = wfType;
    }

    get infoSpecification(): any {
        return this._infoSpecification;
    }
    set infoSpecification(infoSpecification: any) {
        this._infoSpecification = infoSpecification;
    }
}