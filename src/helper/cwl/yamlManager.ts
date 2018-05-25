import * as fs from "fs-extra";
import * as os from "os";
/**
 * A class for creating YAML files that can be used by the cwltool
 * 
 * @export
 * @class YamlManager
 */
export class YamlManager {
    
    /**
     * the path to the yaml file
     * 
     * @private
     * @type {string}
     * @memberof YamlManager
     */
    private filePath: string;
    /**
     * Creates an instance of YamlManager.
     * @param {string} path the path to store the resulting yaml file in
     * @memberof YamlManager
     */
    constructor(path: string) {
        this.filePath = path;
        fs.createFileSync(path);
    }
    /**
     * Add an input parameter to the CWL Yaml File (see: https://www.commonwl.org/draft-3/UserGuide.html)
     * 
     * @param {string} name the name of the parameter
     * @param {string} type the type of the parameter
     * @param {string} value the value of the parameter
     * @memberof YamlManager
     */
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
            case 'int':
            case 'float':
            case 'string':
                fs.appendFileSync(this.filePath, name + ": " + value + os.EOL);
                break;
            default:
                break;
        }
    }
}