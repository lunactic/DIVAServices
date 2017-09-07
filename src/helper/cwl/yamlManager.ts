import * as fs from "fs-extra";
import * as os from "os";
export class YamlManager {

    private filePath: string;

    constructor(path: string) {
        this.filePath = path;
        fs.createFileSync(path);
    }

    public addInputValue(name: string, type: string, value: string) {
        switch (type) {
            case 'file':
                fs.appendFileSync(this.filePath, name + ":" + os.EOL);
                fs.appendFileSync(this.filePath, "  class: File" + os.EOL);
                fs.appendFileSync(this.filePath, "  path: " + value + os.EOL);
                break;
            case 'directory':
                fs.appendFileSync(this.filePath, name + ":" + os.EOL);
                fs.appendFileSync(this.filePath, "  class: Directory" + os.EOL);
                fs.appendFileSync(this.filePath, "  location: " + value + os.EOL);
                break;
            case 'string':
                fs.appendFileSync(this.filePath, name + ": " + value + os.EOL);
                break;
            default:
                break;
        }
    }


}