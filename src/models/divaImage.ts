/**
 * Created by lunactic on 03.11.16.
 */

import * as path from "path";
import * as nconf from "nconf";

/**
 * class representing an internal image
 * 
 * @export
 * @class DivaImage
 */
export class DivaImage {

    /**
     * the root folder folder where the image is stored on the filesystem
     * 
     * @type {string}
     * @memberOf DivaImage
     */
    public rootFolder: string;
    /**
     * the foldername of the image on the filesystem
     * 
     * @type {string}
     * @memberOf DivaImage
     */
    public folder: string;
    /**
     * the name of the image
     * 
     * @type {string}
     * @memberOf DivaImage
     */
    public name: string;
    /**
     * the image extension
     * 
     * @type {string}
     * @memberOf DivaImage
     */
    public extension: string;
    /**
     * the full path to the image
     * 
     * @type {string}
     * @memberOf DivaImage
     */
    public path: string;
    /**
     * the md5 hash of the image
     * 
     * @type {string}
     * @memberOf DivaImage
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
     * get the static url to access this image
     * 
     * @param {string} folder the folder path to the image
     * @returns {string} the static url to access this image
     * 
     * @memberOf DivaImage
     */
    getImageUrl(folder: string): string {
        //TODO: check if the folder parameter can be replace
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/images/" + folder + "/original/" + this.name + "." + this.extension;
    }

}