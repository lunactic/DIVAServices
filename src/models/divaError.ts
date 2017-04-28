export class DivaError extends Error {

    public statusCode: number;
    public errorType: string;
    public message: string;
    constructor(message: string, statusCode: number, errorType: string) {
        super(message);
        Object.setPrototypeOf(this, DivaError.prototype);
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.message = message;
    }
}

