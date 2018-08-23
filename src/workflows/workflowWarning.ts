export enum Severity {
    Low = "low",
    Medium = "medium",
    High = "high",
}

export enum WarningType {
    NumberWarning = "NumberWarning",
}

export class WorkflowWarning {


    private _message: string;
    private _type: WarningType;
    private _severity: Severity;

    /**
     *Creates an instance of WorkflowWarning.
     * @param {string} message the 
     * @param {string} type
     * @param {Severity} [severity]
     * @memberof WorkflowWarning
     */
    constructor(message: string, type: WarningType, severity?: Severity) {
        this._message = message;
        this._type = type;
        if (severity) {
            this._severity = severity;
        } else {
            this._severity = Severity.Low;
        }
    }


    /**
     * Getter message
     * @return {string}
     */
    public get message(): string {
        return this._message;
    }

    /**
     * Getter severity
     * @return {Severity}
     */
    public get severity(): Severity {
        return this._severity;
    }

    /**
     * Setter message
     * @param {string} value
     */
    public set message(value: string) {
        this._message = value;
    }

    /**
     * Setter severity
     * @param {Severity} value
     */
    public set severity(value: Severity) {
        this._severity = value;
    }

}