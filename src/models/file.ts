import * as url from 'url';
/**
 * Created by lunactic on 03.11.16.
 */

import * as path from "path";
import * as nconf from "nconf";

/**
 * class representing an internal data item
 * 
 * @export
 * @class DivaData
 */
export class File {

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


    static CreateFile(collection: string, filename: string, md5?: string): File {
        let item = new File();
        item.collection = collection;
        item.filename = filename;
        item.extension = filename.split(".").pop();
        item.path = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "original" + path.sep + filename;
        item.url = "http://" + nconf.get("server:rootUrl") + "/files/" + collection + "/original/" + filename;
        item.md5 = md5;
        return item;
    }

}