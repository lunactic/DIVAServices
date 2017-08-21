import * as fs from "fs-extra";
import * as os from "os";
export class CwlManager {

    private filePath: string;
    private dockerImage: string;

    constructor(path: string, dockerImage: string) {
        this.filePath = path;
        this.dockerImage = dockerImage;
    }

    public initialize() {

        //Write header information
        fs.writeFileSync(this.filePath, 'cwlVersion: 1.0' + os.EOL);
        fs.appendFileSync(this.filePath, 'class: CommandLineTool' + os.EOL);
        fs.appendFileSync(this.filePath, 'baseCommand: /input/script.sh' + os.EOL);
        fs.appendFileSync(this.filePath, 'hints:' + os.EOL);
        fs.appendFileSync(this.filePath, '  DockerRequirement:' + os.EOL);
        fs.appendFileSync(this.filePath, '    dockerPull:' + this.dockerImage + os.EOL);
        fs.appendFileSync(this.filePath, '    dockerOutputDirectory: /output' + os.EOL);
        fs.appendFileSync(this.filePath, 'inputs:' + os.EOL);

    }

    public addInput(type: string, name: string, position: number) {
        fs.appendFileSync(this.filePath, '  ' + name + ':' + os.EOL);
        fs.appendFileSync(this.filePath, '    type: ' + type + os.EOL);
        fs.appendFileSync(this.filePath, '    inputBinding:' + os.EOL);
        fs.appendFileSync(this.filePath, '      position: ' + position + os.EOL);

    }

    public async startOutputs() {
        fs.appendFileSync(this.filePath, 'outputs:' + os.EOL);
    }

    public async addOutput(type: string, name: string, glob: string) {
        fs.appendFileSync(this.filePath, '  ' + name + ':' + os.EOL);
        fs.appendFileSync(this.filePath, '    type: ' + type + os.EOL);
        fs.appendFileSync(this.filePath, '    outputBinding:' + os.EOL);
        fs.appendFileSync(this.filePath, '      glob: "' + glob + '"' + os.EOL);
    }
}