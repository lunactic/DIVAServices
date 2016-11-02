/**
 * Created by lunactic on 02.11.16.
 */

"use strict"
/**
 *Class representing a process to be executed
 */
class Process {
    public static id: string = "";
    public static algorithmIdentifier: string = "";
    public static executableType: string = "";
    public static req = null;
    public static method: string = "";
    public static image = null;
    public static rootFolder: string = "";
    public static outputFolder: string = "";
    public static methodFolder: string = "";
    public static neededParameters = null;
    public static inputParameters: string = null;
    public static inputHighlighters: string = null;
    public static inputFolder: string = "";
    public static parameters = null;
    public static programType: string = "";
    public static executablePath: string = "";
    public static resultHandler = null;
    public static resultType: string = "";
    public static resultFile: string = "";
    public static tmpResultFile: string = "";
    public static requireOutputImage = true;
    public static inputImageUrl: string = "";
    public static outputImageUrl: string = "";
    public static result = null;
    public static resultLink: string = "";
    public static data: string = null;
    public static remoteResultUrl: string = "";
    public static remotePaths = [];
    public static type: string = "";


    public static hasFiles: boolean = false;
    public static hasImages: boolean = false;
}
export = Process;