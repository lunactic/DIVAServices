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
export class DivaData {

    /**
     * the root folder folder where the image is stored on the filesystem
     * 
     * @type {string}
     * @memberOf DivaData
     */
    public rootFolder: string;
    /**
     * the foldername of the image on the filesystem
     * 
     * @type {string}
     * @memberOf DivaData
     */
    public folder: string;
    /**
     * the name of the image
     * 
     * @type {string}
     * @memberOf DivaData
     */
    public name: string;
    /**
     * the image extension
     * 
     * @type {string}
     * @memberOf DivaData
     */
    public extension: string;
    /**
     * the full path to the image
     * 
     * @type {string}
     * @memberOf DivaData
     */
    public path: string;
    /**
     * the md5 hash of the image
     * 
     * @type {string}
     * @memberOf DivaData
     */
    public md5: string;

    constructor() {
        this.rootFolder = "";
        this.folder = "";
        this.name = "";
        this.extension = "";
        this.path = "";
        this.md5 = "";
    }


    /**
     * get the static url to access this data item
     * 
     * @param {string} folder the folder path to the data item
     * @returns {string} the static url to access this data item
     * 
     * @memberOf DivaData
     */
    getDataUrl(folder: string): string {
        //TODO: check if the folder parameter can be replace
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/data/" + folder + "/original/" + this.name + "." + this.extension;
    }

}