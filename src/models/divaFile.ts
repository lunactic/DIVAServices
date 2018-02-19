/**
 * Created by Marcel Würsch on 03.11.16.
 */

import * as path from "path";
import * as nconf from "nconf";
import * as md5 from "md5";
import * as fs from "fs-extra";
/**
 * class representing an internal data item
 * 
 * @export
 * @class DivaFile
 */
export class DivaFile {

    /**
     * the folder name of the file on the filesystem
     * 
     * @type {string}
     * @memberOf File
     */
    public folder: string;
    /**
     * the name of the file
     * 
     * @type {string}
     * @memberOf File
     */
    public filename: string;


    /**
     * the name of the collection
     * @type {string}
     * @memberOf File
     */
    public collection: string;

    /**
     * the file extension
     * 
     * @type {string}
     * @memberOf File
     */
    public extension: string;
    /**
     * the full path to the data file
     * 
     * @type {string}
     * @memberOf File
     */
    public path: string;
    /**
     * the md5 hash of the file
     * 
     * @type {string}
     * @memberOf File
     */
    public md5: string;

    /**
     * the public url to retrieve this file
     */
    public url: string;

    constructor() {
        this.folder = "";
        this.filename = "";
        this.extension = "";
        this.path = "";
        this.md5 = "";
    }


    static CreateFile(collection: string, filename: string, md5?: string): DivaFile {
        let item = new DivaFile();
        item.collection = collection;
        item.filename = filename;
        item.extension = filename.split(".").pop();
        item.path = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "original" + path.sep + filename;
        item.url = "http://" + nconf.get("server:rootUrl") + "/files/" + collection + "/original/" + filename;
        item.md5 = md5;
        return item;
    }

    static CreateFileFull(filePath: string): DivaFile {
        let relativePath = filePath.replace(nconf.get("paths:executablePath") + path.sep, "");
        let item = new DivaFile();
        item.path = filePath;
        item.url = "http://" + nconf.get("server:rootUrl") + "/test/" + relativePath;
        item.filename = path.parse(filePath).base;
        item.extension = path.parse(filePath).ext;
        let base64 = fs.readFileSync(filePath, "base64");
        item.md5 = md5(base64);
        return item;
    }

    static CreateBasicFile(filePath: string): DivaFile {
        let relativePath = filePath.replace(nconf.get("paths:executablePath") + path.sep, "");
        let item = new DivaFile();
        item.path = filePath;
        item.url = "http://" + nconf.get("server:rootUrl") + "/test/" + relativePath;
        item.filename = path.parse(filePath).base;
        item.extension = path.parse(filePath).ext;
        return item;
    }

}