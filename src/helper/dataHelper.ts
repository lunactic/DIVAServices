/**
 * Created by lunactic on 06.02.2017
 */

"use strict";

import * as _ from "lodash";
import * as async from "async";
import * as fs from "fs";
import { IoHelper } from "./ioHelper";
import md5 = require("md5");
import * as nconf from "nconf";
import * as path from "path";
import * as request from "request";
import { Logger } from "../logging/logger";
import { Process } from "../processingQueue/process";
import { DivaData } from "../models/divaData";

/**
 * A class for all data processing function
 * 
 * @export
 * @class DataHelper
 */
export class DataHelper {

    /**
     * The JSON object holding all data information
     * 
     * @static
     * 
     * @memberOf DataHelper
     */
    static dataInfo = JSON.parse(fs.readFileSync(nconf.get("paths:imageInfoFile"), "utf-8"));


    /**
    * Load specific data items of a collection
    * 
    * @static
    * @param {string} collectionName The name of the collection
    * @param {string[]} hashes an array of md5 hashes for data items to load
    * @returns {DivaData[]} The array of loaded images
    * 
    * @memberOf ImageHelper
    */
    static loadCollection(collectionName: string, hashes: string[]): DivaData[] {
        let dataPath = nconf.get("paths:dataRootPath");
        let dataFolder = dataPath + path.sep + collectionName + path.sep;
        let dataItems: DivaData[] = [];

        let filtered = null;

        if (hashes != null) {
            filtered = _.filter(this.dataInfo, function (data: any) {
                return data.collection === collectionName && _.includes(hashes, data.md5);
            });
        } else {
            filtered = _.filter(this.dataInfo, function (data: any) {
                return data.collection === collectionName;
            });
        }
        if (filtered.length > 0) {
            for (let item of filtered) {
                let dataItem = new DivaData();
                dataItem.folder = dataFolder;
                dataItem.filename = path.basename(item.file).split(".")[0];
                dataItem.extension = path.extname(item.file).replace(".", "");
                dataItem.path = item.file;
                dataItem.md5 = item.md5;
                dataItems.push(dataItem);
            }
            return dataItems;
        } else {
            Logger.log("error", "Tried to load collection: " + collectionName + " which does not exist", "DataHelper");
            return [];
        }
    }

    /**
     * Download a data item from a URL and save it on the filesystem
     * 
     * @static
     * @param {string} url the remote url of the image
     * @param {string} folder the local folder to store the data item in
     * @param {string} fileExtension the file type of the data item
     * @param {number} counter the running counter that is assigned to this data item
     * @param {Function} cb the callback function
     * 
     * @memberOf ImageHelper
     */
    static saveUrl(url: string, folder: string, fileExtension: string, counter: number, cb: Function) {
        let dataPath = nconf.get("paths:filesPath");
        let self = this;
        async.waterfall([
            function (imgExtension: string, callback: Function) {
                request(url).pipe(fs.createWriteStream(dataPath + path.sep + "temp_" + counter + "." + fileExtension)).on("close", function (cb: Function) {
                    let data = new DivaData();
                    let base64 = fs.readFileSync(dataPath + path.sep + "temp_" + counter + "." + fileExtension, "base64");
                    let md5String = md5(base64);
                    let dataFolder = dataPath + path.sep + folder + path.sep + "original" + path.sep;
                    let dataName = "input" + counter;
                    data.folder = dataFolder;
                    data.extension = imgExtension;
                    data.path = dataFolder + dataName + "." + imgExtension;
                    data.md5 = md5String;

                    fs.stat(data.path, function (err: any, stat: fs.Stats) {
                        if (err == null) {
                            fs.unlink(dataPath + path.sep + "temp_" + counter + "." + imgExtension);
                            callback(null, data);
                        } else if (err.code === "ENOENT") {
                            fs.renameSync(dataPath + path.sep + "temp_" + counter + "." + imgExtension, data.path);
                        }
                    });
                });
            }
        ], function (err: any, data: DivaData) {
            if (err != null) {
                Logger.log("error", JSON.stringify(err), "DataHelper");
            } else {
                cb(data);
            }
        });
    }

    /**
    * Saves an data item based on its base64 encoding
    * 
    * @static
    * @param {*} data the data object containing the base64 string
    * @param {string} folder the folder to save the data item into
    * @param {string} fileExtension the file extension of the data item
    * @param {number} counter the running counter applied to this data item
    * @param {Function} callback the callback function
    * 
    * @memberOf ImageHelper
    */
    static saveBase64(data: any, folder: string, fileExtension: string, counter: number, callback: Function) {
        let imagePath = nconf.get("paths:filesPath");
        let base64Data = data;
        let md5String = md5(base64Data);

        let dataObject = new DivaData();
        let imgFolder = imagePath + path.sep + folder + path.sep + "original" + path.sep;
        let imgName = "input" + counter;
        fs.stat(imgFolder + imgName, function (err: any, stat: fs.Stats) {
            dataObject.folder = imgFolder;
            dataObject.filename = imgName;
            dataObject.extension = fileExtension;
            dataObject.path = imgFolder + imgName + "." + fileExtension;
            dataObject.md5 = md5String;
            if (err === null) {
                return dataObject;
            } else if (err.code === "ENOENT") {
                fs.writeFile(dataObject.path, base64Data, "base64", function (err: any) {
                    callback(dataObject);
                });
            } else {
                Logger.log("error", "error saving the image", "ImageHelper");
            }
        });
    }

    /**
    * create the information for a collection
    * 
    * @static
    * @param {string} collectionName the name of the collection
    * @param {number} items the number of data items belonging to this collection
    * 
    * @memberOf ImageHelper
    */
    static createCollectionInformation(collectionName: string, items: number): void {
        let status = {
            statusCode: 110,
            statusMessage: "Downloaded 0 of " + items + " items",
            percentage: 0
        };
        IoHelper.saveFile(nconf.get("paths:dataRootPath") + path.sep + collectionName + path.sep + "status.json", status, "utf-8", null);
    }

    /**
     * update the collection information
     * 
     * @static
     * @param {string} collection the name of the collection
     * @param {number} items the total number of images in the collection
     * @param {number} downloaded the number of downloaded images
     * 
     * @memberOf ImageHelper
     */
    static updateCollectionInformation(collection: string, items: number, downloaded: number): void {
        let status = {};
        if (downloaded !== items) {
            status = {
                statusCode: 110,
                statusMessage: "Downloaded " + downloaded + " of " + items + " items",
                percentage: (downloaded / items) * 100
            };
        } else {
            status = {
                statusCode: 200,
                statusMessage: "Collection is available",
                percentage: 100
            };
        }
        let statusFile = nconf.get("paths:dataRootPath") + path.sep + collection + path.sep + "status.json";
        IoHelper.saveFile(statusFile, status, "utf-8", null);
    }

    /**
    * Save the information of an image into the image information file
    * 
    * @static
    * @param {string} md5 the md5 hash of the image
    * @param {string} file the filename of the image
    * @param {string} collection the collection the image belongs to
    * 
    * @memberOf ImageHelper
    */
    static addDataInfo(md5: string, file: string, collection: string): void {
        this.dataInfo.push({ md5: md5, file: file, collection: collection });
        this.saveDataInfo();
    }

    /**
    * save the image information file
    * 
    * @static
    * 
    * @memberOf ImageHelper
    */
    static saveDataInfo(): void {
        IoHelper.saveFile(nconf.get("paths:dataInfoFile"), this.dataInfo, "utf-8", null);
    }
}