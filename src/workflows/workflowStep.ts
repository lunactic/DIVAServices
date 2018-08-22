import { WorkflowInput } from "./workflowInput";
import { WorkflowOutput } from "./workflowOutput";
import _ = require("lodash");

export class WorkflowStep {
    /**
     * The service definition of the step
     *
     * @private
     * @type {*}
     * @memberof WorkflowStep
     */
    private _serviceDefinition: any;
    /**
     * The public JSON definition
     *
     * @private
     * @type {*}
     * @memberof WorkflowStep
     */
    private _infoDefinition: any;


    /**
     * The provided step definition in the POST request
     *
     * @private
     * @type {*}
     * @memberof WorkflowStep
     */
    private _stepDefinition: any;

    /**
     * The WorkflowInputs of this step
     *
     * @private
     * @type {WorkflowInput[]}
     * @memberof WorkflowStep
     */
    private _inputs: WorkflowInput[];
    /**
     * The WorkflowOutputs of this step
     *
     * @private
     * @type {WorkflowOutput[]}
     * @memberof WorkflowStep
     */
    private _outputs: WorkflowOutput[];

    /**
     *Creates an instance of WorkflowStep.
     * @param {string} name The name of the workflow step
     * @param {string} method The method of the workflow step
     * @memberof WorkflowStep
     */
    constructor(stepDefinition: any) {
        this._stepDefinition = stepDefinition;
        this._inputs = [];
        this._outputs = [];
    }



    public addInput(input: WorkflowInput) {
        this._inputs.push(input);
    }

    public addOutput(output: WorkflowOutput) {
        //rename infoSpecification name
        output.infoSpecification = _.cloneDeep(output.infoSpecification);
        output.infoSpecification[Object.keys(output.infoSpecification)[0]].name = this.name + '_' + output.infoSpecification[Object.keys(output.infoSpecification)[0]].name;
        this._outputs.push(output);
    }

    /**
     * Getter name
     * @return {string}
     */
    public get name(): string {
        return this._stepDefinition.name;
    }

    /**
     * Getter method
     * @return {string}
     */
    public get method(): string {
        return this._stepDefinition.method;
    }

    /**
     * Getter serviceDefinition
     * @return {any}
     */
    public get serviceDefinition(): any {
        return this._serviceDefinition;
    }

    /**
     * Getter infoDefinition
     * @return {any}
     */
    public get infoDefinition(): any {
        return this._infoDefinition;
    }

    /**
     * Getter stepDefinition
     * @return {any}
     */
    public get stepDefinition(): any {
        return this._stepDefinition;
    }

    /**
     * Getter inputs
     * @return {WorkflowInput[]}
     */
    public get inputs(): WorkflowInput[] {
        return this._inputs;
    }

    /**
     * Getter outputs
     * @return {WorkflowOutput[]}
     */
    public get outputs(): WorkflowOutput[] {
        return this._outputs;
    }

    /**
     * Setter serviceDefinition
     * @param {any} value
     */
    public set serviceDefinition(value: any) {
        this._serviceDefinition = value;
    }

    /**
     * Setter infoDefinition
     * @param {any} value
     */
    public set infoDefinition(value: any) {
        this._infoDefinition = value;
    }

    /**
     * Setter stepDefinition
     * @param {any} value
     */
    public set stepDefinition(value: any) {
        this._stepDefinition = value;
    }

    /**
     * Setter inputs
     * @param {WorkflowInput[]} value
     */
    public set inputs(value: WorkflowInput[]) {
        this._inputs = value;
    }

    /**
     * Setter outputs
     * @param {WorkflowOutput[]} value
     */
    public set outputs(value: WorkflowOutput[]) {
        this._outputs = value;
    }

}