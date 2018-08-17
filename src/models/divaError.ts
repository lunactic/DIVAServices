export class DivaError extends Error {

    private _statusCode: number;
    private _errorType: string;
    public message: string;

    /**
     * Create a new instance of DivaError
     * 
     * @param {string} message The error message
     * @param {number} statusCode The status code to return
     * @param {string} errorType The type of error
     * @memberof DivaError
     */
    constructor(message: string, statusCode: number, errorType: string) {
        super(message);
        Object.setPrototypeOf(this, DivaError.prototype);
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.message = message;
    }


    /**
     * Getter statusCode
     * @return {number}
     */
	public get statusCode(): number {
		return this._statusCode;
	}

    /**
     * Getter errorType
     * @return {string}
     */
	public get errorType(): string {
		return this._errorType;
	}

    /**
     * Setter statusCode
     * @param {number} value
     */
	public set statusCode(value: number) {
		this._statusCode = value;
	}

    /**
     * Setter errorType
     * @param {string} value
     */
	public set errorType(value: string) {
		this._errorType = value;
	}

}

