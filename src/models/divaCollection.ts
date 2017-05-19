/**
 * Created by Marcel Würsch on 03.11.16.
 */

import * as path from "path";
import * as nconf from "nconf";

/**
 * class representing an internal data item
 * 
 * @export
 * @class DivaFolder
 */
export class DivaCollection {

    /**
     * the folder name of the file on the filesystem
     * 
     * @type {string}
     * @memberOf File
     */
    public folder: string;

    /**
     * the name of the collection
     * @type {string}
     * @memberOf File
     */
    public collection: string;

    /**
     * the public url to retrieve this file
     */
    public url: string;

    public zipUrl: string;

    constructor() {
        this.folder = "";
        this.collection = "";
        this.url = "";
        this.zipUrl;
    }


    static CreateCollection(collection: string): DivaCollection {
        let item = new DivaCollection();
        item.collection = collection;
        item.folder = nconf.get("paths:filesPath") + path.sep + collection + path.sep;
        item.url = "http://" + nconf.get("server:rootUrl") + "/files/" + collection;
        item.zipUrl = "http://" + nconf.get("server:rootUrl") + "/files/" + collection + "/zip";
        return item;
    }

    static CreateCollectionFull(filePath: string): DivaCollection {
        let relativePath = filePath.replace(nconf.get("paths:executablePath") + path.sep, "");
        let item = new DivaCollection();
        item.collection = "";
        item.url = "http://" + nconf.get("server:rootUrl") + "/test/" + relativePath;
        item.zipUrl = "http://" + nconf.get("server:rootUrl") + "/test/" + relativePath;
        return item;
    }

}