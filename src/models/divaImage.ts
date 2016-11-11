/**
 * Created by lunactic on 03.11.16.
 */

import * as path from "path";
import * as nconf from "nconf";

export class DivaImage {

    public rootFolder: string;
    public folder: string;
    public name: string;
    public extension: string;
    public path: string;
    public md5: string;

    constructor() {
        this.rootFolder = "";
        this.folder = "";
        this.name = "";
        this.extension = "";
        this.path = "";
        this.md5 = "";
    }


    getOutputImage(folder: string): string {
        return folder + path.sep + this.name + "." + this.extension;
    }

    getImageUrl(folder: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/images/" + folder + "/original/" + this.name + "." + this.extension;
    }

}