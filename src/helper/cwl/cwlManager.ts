import * as fs from "fs-extra";
import * as os from "os";
/**
 * A class for creating *.cwl files that can be used by the cwltool
 * 
 * @export
 * @class CwlManager
 */
export class CwlManager {

    private filePath: string;
    private dockerImage: string;
    /**
     * Creates an instance of CwlManager.
     * @param {string} path the path to where the cwl file should be stored
     * @param {string} dockerImage the name of the docker image to be used
     * @memberof CwlManager
     */
    constructor(path: string, dockerImage: string) {
        this.filePath = path;
        this.dockerImage = dockerImage;
    }
    /**
     * Initialize a new cwl file
     * 
     * @param {string} executable path to the executable
     * @memberof CwlManager
     */
    public initialize(executable: string) {
        //Write header information
        fs.writeFileSync(this.filePath, 'cwlVersion: v1.0' + os.EOL);
        fs.appendFileSync(this.filePath, 'class: CommandLineTool' + os.EOL);
        fs.appendFileSync(this.filePath, 'baseCommand: ' + executable + os.EOL);
        fs.appendFileSync(this.filePath, 'stdout: logFile.txt' + os.EOL);
        fs.appendFileSync(this.filePath, 'hints:' + os.EOL);
        fs.appendFileSync(this.filePath, '  DockerRequirement:' + os.EOL);
        fs.appendFileSync(this.filePath, '    dockerPull: ' + this.dockerImage + os.EOL);
        fs.appendFileSync(this.filePath, '    dockerOutputDirectory: /output' + os.EOL);
        fs.appendFileSync(this.filePath, 'inputs:' + os.EOL);
    }
    /**
     * add an input parameter to the cwl file
     * 
     * @param {string} type the type of the parameter
     * @param {string} name the name of the parameter
     * @param {number} position the position of the parameter
     * @memberof CwlManager
     */
    public addInput(type: string, name: string, position: number) {
        fs.appendFileSync(this.filePath, '  ' + name + ':' + os.EOL);
        fs.appendFileSync(this.filePath, '    type: ' + type + os.EOL);
        fs.appendFileSync(this.filePath, '    inputBinding:' + os.EOL);
        fs.appendFileSync(this.filePath, '      position: ' + position + os.EOL);
    }
    /**
     * switch from defining inputs to defining outputs
     * 
     * @memberof CwlManager
     */
    public async startOutputs() {
        fs.appendFileSync(this.filePath, 'outputs:' + os.EOL);
    }

    /**
     * Add an output parameter to the cwl file
     * see: https://www.commonwl.org/draft-3/UserGuide.html
     * 
     * @param {string} type the type of the output 
     * @param {string} name the name of the output
     * @param {string} glob the glob search pattern for the output
     * @memberof CwlManager
     */
    public async addOutput(type: string, name: string, glob: string) {
        switch (type) {
            case 'stdout':
                fs.appendFileSync(this.filePath, '  output:' + os.EOL);
                fs.appendFileSync(this.filePath, '    type: stdout' + os.EOL);
                break;
            case 'Directory':
                fs.appendFileSync(this.filePath, '  ' + name + ':' + os.EOL);
                fs.appendFileSync(this.filePath, '    type: ' + type + os.EOL);
                fs.appendFileSync(this.filePath, '    outputBinding:' + os.EOL);
                fs.appendFileSync(this.filePath, '      glob: "' + name + '"' + os.EOL);
                break;
            default:
                fs.appendFileSync(this.filePath, '  ' + name + ':' + os.EOL);
                fs.appendFileSync(this.filePath, '    type: ' + type + os.EOL);
                fs.appendFileSync(this.filePath, '    outputBinding:' + os.EOL);
                fs.appendFileSync(this.filePath, '      glob: ' + glob + os.EOL);
                break;
        }
    }

}