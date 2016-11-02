/**
 *Class representing a process to be executed
 */
declare class Process {
    static id: string;
    static algorithmIdentifier: string;
    static executableType: string;
    static req: any;
    static method: string;
    static image: any;
    static rootFolder: string;
    static outputFolder: string;
    static methodFolder: string;
    static neededParameters: any;
    static inputParameters: string;
    static inputHighlighters: string;
    static inputFolder: string;
    static parameters: any;
    static programType: string;
    static executablePath: string;
    static resultHandler: any;
    static resultType: string;
    static resultFile: string;
    static tmpResultFile: string;
    static requireOutputImage: boolean;
    static inputImageUrl: string;
    static outputImageUrl: string;
    static result: any;
    static resultLink: string;
    static data: string;
    static remoteResultUrl: string;
    static remotePaths: any[];
    static type: string;
    static hasFiles: boolean;
    static hasImages: boolean;
}
export = Process;
