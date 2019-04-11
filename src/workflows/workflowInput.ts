import * as _ from 'lodash';
import { isNullOrUndefined } from "util";

export class WorkflowInput {
    private _wfType: string;
    private _name: string;
    private _reference: string;
    private _defaultValue: any;
    private _infoSpecification: any;
    private _serviceSpecification: any;
    private _isData: boolean;

    constructor(wfType: string, name: string, infoSpecification: any, serviceSpecification: any, reference?: string, defaultValue?: any) {
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
        this.serviceSpecification = _.clone(serviceSpecification;
        this.serviceSpecification[this.name] = this.serviceSpecification[name.split('_')[name.split('_').length -1 ]];
        delete this.serviceSpecification[name.split('_')[name.split('_').length -1 ]];
        this.defaultValue = defaultValue;
    }

    public get wfType(): string {
        return this._wfType;
    }

    public set wfType(wfType: string) {
        this._wfType = wfType;
    }

    public get name(): string {
        return this._name;
    }

    public set name(name: string) {
        this._name = name;
    }

    public get reference() {
        return this._reference;
    }

    public set reference(reference: string) {
        this._reference = reference;
    }

    public get defaultValue() {
        return this._defaultValue;
    }

    public set defaultValue(defaultValue: any) {
        this._defaultValue = defaultValue;
    }

    public get infoSpecification() {
        return this._infoSpecification;
    }

    public set infoSpecification(infoSpecification: any) {
        this._infoSpecification = infoSpecification;
    }

    public get serviceSpecification() {
        return this._serviceSpecification;
    }

    public set serviceSpecification(serviceSpecification: any) {
        this._serviceSpecification = serviceSpecification;
    }

    public get isData(): boolean {
        return this._isData;
    }

    public set isData(isData: boolean) {
        this._isData = isData;
    }

    public hasReference(): boolean {
        return !isNullOrUndefined(this.reference);
    }

    public hasDefaultValue(): boolean {
        return !isNullOrUndefined(this.defaultValue);
    }
}
