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
                fs.appendFileSync(this.filePath, name + ":\n");
                fs.appendFileSync(this.filePath, "  class: File\n");
                fs.appendFileSync(this.filePath, "  path: " + value + "\n");
                break;
            case 'string':
                fs.appendFileSync(this.filePath, name + ": " + value);
                break;
            default:
                break;
        }
    }


}