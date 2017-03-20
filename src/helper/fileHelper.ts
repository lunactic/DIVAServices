import { resolve } from 'dns';
/**
 * Created by lunactic on 03.11.16.
 */
"use strict";

import * as _ from "lodash";
import * as async from "async";
import * as fs from "fs";
import { IoHelper } from "./ioHelper";
import md5 = require("md5");
import * as nconf from "nconf";
import * as path from "path";
import * as request from "request-promise";
import { Logger } from "../logging/logger";
import { Process } from "../processingQueue/process";
import { File } from "../models/file";

/**
 * A class for all file handling 
 * 
 * @export
 * @class FileHelper
 */
export class FileHelper {

    /**
     * The JSON object holding all file information
     * 
     * @static
     * 
     * @memberOf FileHelper
     */
    static filesInfo = JSON.parse(fs.readFileSync(nconf.get("paths:imageInfoFile"), "utf-8"));

    /**
     * saves a file on the filesystem
     * 
     * @static
     * @param {*} input the input object
     * @param {Process} process the process of this image
     * @param {number} numberOfImages the total number of images to save
     * @param {number} counter the running counter this image is assigned to
     * 
     * @memberOf FileHelper
     */
    static async saveFile(input: any, process: Process, numberOfImages: number, counter: number) {
        let self = this;
        let file = null;
        switch (input.type) {
            case "base64":
                try {
                    file = await self.saveBase64(input.value, process.rootFolder, counter);
                    self.addFileInfo(file.md5, file.path, process.rootFolder);
                    self.updateCollectionInformation(process.rootFolder, numberOfImages, counter);
                    Logger.log("trace", "saved file", "FileHelper");
                    Promise.resolve();
                } catch (error) {
                    Logger.log("error", "error saving file", "FileHelper");
                    Promise.reject(error);
                }
                break;
            case "url":
                try {
                    file = await self.saveUrl(input.value, process.rootFolder, counter);
                    self.addFileInfo(file.md5, file.path, process.rootFolder);
                    self.updateCollectionInformation(process.rootFolder, numberOfImages, counter);
                    Promise.resolve();
                } catch (error) {
                    Logger.log("error", "error saving file", "FileHelper");
                    Promise.reject(error);
                }
                break;
        }
    }

    /**
     * Checks if an image exists on the file system
     * 
     * @static
     * @param {string} md5 the md5 hash of the image
     * 
     * @memberOf FileHelper
     */
    static fileExists(md5: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let filtered = this.filesInfo.filter(function (item: any) {
                return item.md5 === md5;
            });
            if (filtered.length > 0) {
                resolve({ imageAvailable: true, collection: filtered[0].collection });
            } else {
                resolve({ imageAvailable: false });
            }
        });
    }

    /**
     * Saves an image based on its base64 encoding
     * 
     * @static
     * @param {*} file the image object containing the base64 string
     * @param {string} folder the folder to save the image into
     * @param {number} counter the running counter applied to this image
     * 
     * @memberOf FileHelper
     */
    static saveBase64(file: any, folder: string, counter: number): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let imagePath = nconf.get("paths:filesPath");
            let base64Data = file.value.replace(/^data:image\/png;base64,/, "");
            let md5String = md5(base64Data);

            let fileObject = new File();
            let fileFolder = imagePath + path.sep + folder + path.sep + "original" + path.sep;
            let fileName = file.name;
            let fileExtension = this.getImageExtensionBase64(base64Data);
            fs.stat(fileFolder + fileName, function (err: any, stat: fs.Stats) {
                fileObject.folder = fileFolder;
                fileObject.filename = fileName;
                fileObject.extension = fileExtension;
                fileObject.path = fileFolder + fileName + "." + fileExtension;
                fileObject.md5 = md5String;
                if (err === null) {
                    resolve(file);
                } else if (err.code === "ENOENT") {
                    fs.writeFile(fileObject.path, base64Data, "base64", function (err: any) {
                        resolve(fileObject);
                    });
                } else {
                    reject(err);
                    Logger.log("error", "error saving the image", "ImageHelper");
                }
            });
        });
    }

    /**
     * Saves an file stored within a JSON object
     * 
     * @static
     * @param {*} file the JSON object of the image
     * @param {Process} process the process of this image
     * @param {string} filename the filename of this image
     * 
     * @memberOf FileHelper
     */
    static saveJson(file: any, process: Process, filename: string) {
        let base64Data = file.replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync(process.outputFolder + path.sep + filename, base64Data, "base64");
    }

    /**
     * Download a file from a URL and save it on the filesystem
     * 
     * @static
     * @param {string} url the remote url of the image
     * @param {string} folder the local folder to store the image in
     * @param {number} counter the running counter that is assigned to this image
     * 
     * @memberOf FileHelper
     */
    static async saveUrl(url: string, folder: string, counter?: number, filename?: string): Promise<File> {
        return new Promise<File>(async (resolve, reject) => {
            let filePath = nconf.get("paths:filesPath");
            let file = new File();
            let tmpFilePath: string = "";
            let fileName: string = "";

            var headerResponse = await request.head(url);
            let fileExtension = this.getFileExtension(headerResponse["content-type"]);

            if (filename != null) {
                tmpFilePath = filePath + path.sep + "temp_" + filename + "." + fileExtension;
                fileName = filename;
            } else if (counter != null) {
                tmpFilePath = filePath + path.sep + "temp_" + counter + "." + fileExtension;
                fileName = "input" + counter;
            }

            var response = await request(url).pipe(fs.createWriteStream(tmpFilePath));
            let base64 = fs.readFileSync(tmpFilePath, "base64");

            let md5String = md5(base64);
            let imgFolder = filePath + path.sep + folder + path.sep + "original" + path.sep;
            file.filename = fileName;
            file.folder = imgFolder;
            file.extension = fileExtension;
            file.path = imgFolder + fileName + "." + fileExtension;
            file.md5 = md5String;

            fs.stat(file.path, function (err: any, stat: fs.Stats) {
                if (err == null) {
                    fs.unlink(tmpFilePath);
                } else if (err.code === "ENOENT") {
                    fs.renameSync(tmpFilePath, file.path);
                }
                resolve(file);
            });
        });

    }

    /**
     * load all files with the same md5 hash
     * 
     * @static
     * @param {string} md5 the md5 hash of the image
     * @returns {DivaImage[]} An array of images
     * 
     * @memberOf ImageHelper
     */
    static loadFilesMd5(md5: string): File[] {
        let filtered = this.filesInfo.filter(function (item: File) {
            return item.md5 === md5;
        });
        let files: File[] = [];

        for (var item of filtered) {
            let filePath = item.path;
            let file: File = new File();
            file.folder = path.dirname(filePath);
            file.extension = path.extname(filePath).substring(1);
            file.filename = path.basename(filePath, file.extension);
            file.path = filePath;
            file.md5 = md5;
            files.push(file);
        }

        return files;


    }

    /**
     * 
     * Get the name of all existing collections
     * 
     * @static
     * @returns {String[]} An array of collection names
     * 
     * @memberOf FileHelper
     */
    static getAllCollections(): String[] {
        let collections = [];

        let fileInfo: any = IoHelper.openFile(nconf.get("paths:imageInfoFile"));
        for (var file of fileInfo) {
            if (!(collections.indexOf(file.collection) > -1)) {
                collections.push(file.collection);
            }
        }
        return collections;
    }

    /**
     * Load specific files of a collection
     * 
     * @static
     * @param {string} collectionName The name of the collection
     * @param {string[]} hashes an array of md5 hashes for files to load
     * @returns {File[]} The array of loaded files
     * 
     * @memberOf FileHelper
     */
    static loadCollection(collectionName: string, hashes: string[]): File[] {
        let filePath = nconf.get("paths:filesPath");
        let fileFolder = filePath + path.sep + collectionName + path.sep;
        let files: File[] = [];

        let filtered = null;

        if (hashes != null) {
            filtered = _.filter(this.filesInfo, function (file: any) {
                return file.collection === collectionName && _.includes(hashes, file.md5);
            });
        } else {
            filtered = _.filter(this.filesInfo, function (file: any) {
                return file.collection === collectionName;
            });
        }
        if (filtered.length > 0) {
            for (let item of filtered) {
                let file = File.CreateFile(collectionName, path.basename(item.file), item.md5);
                files.push(file);
            }
            return files;
        } else {
            Logger.log("error", "Tried to load collection: " + collectionName + " which does not exist", "ImageHelper");
            return [];
        }
    }

    /**
     * Save the information of an file into the file information file
     * 
     * @static
     * @param {string} md5 the md5 hash of the file
     * @param {string} file the filename of the file
     * @param {string} collection the collection the file belongs to
     * 
     * @memberOf FileHelper
     */
    static addFileInfo(md5: string, file: string, collection: string): void {
        this.filesInfo.push({ md5: md5, file: file, collection: collection });
        this.saveFileInfo();
    }

    /**
     * get information for a file
     * 
     * @static
     * @param {string} md5 the md5 hash of the file
     * @returns {*} the information belonging to this file
     * 
     * @memberOf FileHelper
     */
    static getFileInfo(md5: string): any {
        return _.find(this.filesInfo, function (info: any) {
            return info.md5 === md5;
        });
    }

    /**
     * save the file information file
     * 
     * @static
     * 
     * @memberOf FileHelper
     */
    static async saveFileInfo() {
        await IoHelper.saveFile(nconf.get("paths:imageInfoFile"), this.filesInfo, "utf-8");
    }


    /**
     * create the information for a collection
     * 
     * @static
     * @param {string} collectionName the name of the collection
     * @param {number} files the number of files belonging to this collection
     * 
     * @memberOf FileHelper
     */
    static async createCollectionInformation(collectionName: string, files: number) {
        let status = {
            statusCode: 110,
            statusMessage: "Downloaded 0 of " + files + " images",
            percentage: 0
        };
        await IoHelper.saveFile(nconf.get("paths:filesPath") + path.sep + collectionName + path.sep + "status.json", status, "utf-8");
    }

    /**
     * Check if a collection exists
     * 
     * @static
     * @param {string} collection the name of the collection
     * @returns {boolean} indicator whether or not the collection exists
     * 
     * @memberOf FileHelper
     */
    static checkCollectionAvailable(collection: string): boolean {
        try {
            let stats = fs.statSync(nconf.get("paths:filesPath") + path.sep + collection);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * update the collection information
     * 
     * @static
     * @param {string} collection the name of the collection
     * @param {number} files the total number of files in the collection
     * @param {number} downloaded the number of downloaded files
     * 
     * @memberOf ImageHelper
     */
    static async updateCollectionInformation(collection: string, files: number, downloaded: number) {
        let status = {};
        if (downloaded !== files) {
            status = {
                statusCode: 110,
                statusMessage: "Downloaded " + downloaded + " of " + files + " images",
                percentage: (downloaded / files) * 100
            };
        } else {
            status = {
                statusCode: 200,
                statusMessage: "Collection is available",
                percentage: 100
            };
        }
        let statusFile = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "status.json";
        await IoHelper.saveFile(statusFile, status, "utf-8");
    }

    /**
     * Get information about a collection
     * 
     * @static
     * @param {string} collection the name of the collection
     * @returns {*} the file information for the collection
     * 
     * @memberOf ImageHelper
     */
    static getCollectionInformation(collection: string): any {
        let statusFile = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "status.json";
        return IoHelper.openFile(statusFile);
    }

    /**
     * 
     * 
     * @static
     * @param {string} contentType the content type of the image
     * @returns {string} the file ending to use for this image type
     * 
     * @memberOf ImageHelper
     */
    static getFileExtension(contentType: string): string {
        switch (contentType) {
            case "image/jpeg":
                return "jpg";
            case "image/tiff":
                return "tiff";
            case "image/png":
                return "png";
        }
    }

    /**
     * Get the image extension from a base64 string
     * 
     * @static
     * @param {string} base64 the base64 string
     * @returns {string} the file ending to use for the image type
     * 
     * @memberOf ImageHelper
     */
    static getImageExtensionBase64(base64: string): string {
        if (base64.indexOf("/9j/4AAQ") !== -1 || base64.indexOf("_9j_4AA") !== -1) {
            return "jpg";
        }
        if (base64.indexOf("iVBORw0KGgoAAAANSUhEU") !== -1) {
            return "png";
        }
    }
}