/**
 * Created by Marcel Würsch on 03.11.16.
 */
"use strict";

import * as fs from "fs-extra";
import * as im from 'imagemagick-cli';
import * as _ from "lodash";
import * as mime from "mime";
import * as nconf from "nconf";
import * as path from "path";
import * as request from "request-promise";
import * as url from "url";
import { isNullOrUndefined } from "util";
import { Logger } from "../logging/logger";
import { DivaError } from '../models/divaError';
import { DivaFile } from "../models/divaFile";
import { Process } from "../processingQueue/process";
import { IoHelper } from "./ioHelper";

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
     * @memberof FileHelper
     */

    static filesInfo = IoHelper.readFile(nconf.get("paths:imageInfoFile"));

    /**
     * 
     * @param path path to the file to check
     */
    static async fileExists(path: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                await fs.access(path);
                resolve(true);
            } catch (error) {
                resolve(false);
            }
        });

    }

    /**
     * Saves a file based on its base64 encoding
     * 
     * @static
     * @param {*} file  the file object containing the base64 string
     * @param {string} folder the folder to save the image into
     * @returns {Promise<DivaFile>} the DivaFile created for the provided file data
     * @memberof FileHelper
     */
    static saveBase64(file: any, folder: string): Promise<DivaFile> {
        return new Promise<DivaFile>(async (resolve, reject) => {
            let imagePath = nconf.get("paths:filesPath");
            //strip header information from the base64 string (necessary for Spotlight)
            let splitValues = file.value.split(',');
            let base64Data;
            if (splitValues.length > 1) {
                base64Data = splitValues[1];
            } else {
                base64Data = splitValues[0];
            }
            let fileObject = new DivaFile();
            let fileFolder = imagePath + path.sep + folder + path.sep + "original" + path.sep;
            let fileName = "";
            if (file.name !== null) {
                fileName = file.name;
            } else {
                reject(new DivaError("filename not provided", 500, "FileNameError"));
            }
            try {
                if (await IoHelper.fileExists(fileFolder + fileName)) {
                    resolve(file);

                } else {
                    fileObject.folder = fileFolder;
                    fileObject.filename = fileName;
                    fileObject.path = fileFolder + fileName;
                    await fs.writeFile(fileObject.path, base64Data, { encoding: "base64" });
                    resolve(fileObject);
                }
            } catch (error) {
                Logger.log("error", "error saving the image", "ImageHelper");
                return reject(new DivaError("Error while saving the image", 500, "FileError"));
            }
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
     * @memberof FileHelper
     */
    static async saveJson(file: any, process: Process, filename: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let base64Data = file.replace(/^data:image\/png;base64,/, "");
            await fs.writeFile(process.outputFolder + path.sep + filename, base64Data, { encoding: "base64" });
            resolve();
        });
    }


    /**
     * Downloads a file from a given URL
     * 
     * @static
     * @param {string} url the URL pointing to a file
     * @param {string} filepath the filepath to save the file to
     * @returns {Promise<void>} 
     * @memberof FileHelper
     */
    static async downloadFile(url: string, filepath: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            request.get(url).pipe(fs.createWriteStream(filepath, { flags: 'w' })).on("finish", function () {
                resolve();
            });
        });
    }

    /**
     * save a Zip file from a URL and unzip it
     * 
     * @static
     * @param {string} url the URL pointing to a zip file
     * @param {string} folder the folder to unzip the contents into
     * @returns {Promise<DivaFile[]>} an array of the unzipped files
     * @memberof FileHelper
     */
    static async saveZipUrl(url: string, folder: string): Promise<DivaFile[]> {
        return new Promise<DivaFile[]>(async (resolve, reject) => {
            try {
                let divaFiles: DivaFile[] = [];
                let filePath = nconf.get("paths:filesPath");
                let tmpFilePath: string = filePath + path.sep + folder + path.sep + "data.zip";
                let rootPath = filePath + path.sep + folder + path.sep + "original";
                await this.downloadFile(url, tmpFilePath);
                await IoHelper.unzipFile(tmpFilePath, rootPath);
                let files: string[] = await IoHelper.readFolderRecursive(rootPath);
                let imageCounter: number = 0;
                for (var file of files) {
                    if (!(await IoHelper.isDirectory(file))) {
                        let divaFile = new DivaFile();
                        let filename = path.basename(file);
                        let base64 = fs.readFileSync(file, "base64");
                        divaFile.filename = filename;
                        divaFile.folder = rootPath + path.sep;
                        divaFile.extension = mime.getExtension(mime.getType(file));
                        divaFile.path = file;
                        await FileHelper.addFileInfo(divaFile.path, folder);
                        await FileHelper.updateCollectionInformation(folder, files.length, ++imageCounter);
                        divaFiles.push(divaFile);
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * downloads a file from a given URL and stores it in a folder
     * a local filename can be provided that should be assigned to this file
     * 
     * @static
     * @param {string} downloadUrl the remote url of the image
     * @param {string} folder the local folder to store the image in
     * @param {string} [filename] the filename that should be assigned to this file (including the extension)
     * @returns {Promise<DivaFile>} the DivaFile created for the downloaded file
     * @memberof FileHelper
     */
    static async saveFileUrl(downloadUrl: string, folder: string, filename?: string): Promise<DivaFile> {
        return new Promise<DivaFile>(async (resolve, reject) => {
            try {
                let filePath = nconf.get("paths:filesPath");
                let file = new DivaFile();
                let tmpFilePath: string = "";
                let fileName: string = "";

                var headerResponse = await request.head(downloadUrl);
                if (filename != null) {
                    tmpFilePath = filePath + path.sep + "temp_" + filename;
                    fileName = filename;
                } else {
                    //use the existing filename and extension
                    fileName = path.basename(url.parse(downloadUrl).pathname);
                    tmpFilePath = filePath + path.sep + "temp_" + fileName;
                }

                await this.downloadFile(downloadUrl, tmpFilePath);

                let imgFolder = filePath + path.sep + folder + path.sep + "original" + path.sep;
                file.filename = fileName;
                file.folder = imgFolder;
                file.path = imgFolder + fileName;
                try {
                    let stats: fs.Stats = await fs.stat(file.path);
                    if (stats.isFile()) {
                        fs.rename(tmpFilePath, file.path);
                        resolve(file);
                    }
                } catch (error) {
                    if (error.code === "ENONENT") {
                        await fs.rename(tmpFilePath, file.path);
                        resolve(file);
                    }
                    if (error.code === "ENOENT") {
                        await fs.rename(tmpFilePath, file.path);
                        resolve(file);
                    }
                }
            } catch (error) {
                reject(error);
            }
        });

    }

    /**
     * save a text file
     * 
     * @static
     * @param {string} data the textual data to save
     * @param {string} folder the folder to save the file in
     * @param {string} filename the filename including the file extension
     * @returns {Promise<DivaFile>} the DivaFile created for this file
     * @memberof FileHelper
     */
    static saveFileText(data: string, folder: string, filename: string): Promise<DivaFile> {
        let self = this;
        return new Promise<DivaFile>(async (resolve, reject) => {
            let filesPath = nconf.get("paths:filesPath");
            let filePath: string;
            let file = new DivaFile();
            let fileName: string = "";
            if (filename != null) {
                filePath = filesPath + path.sep + folder + path.sep + "original" + path.sep + filename;
                fileName = filename;
            } else {
                reject(new DivaError("Required filename not provided", 500, "FileNameError"));
            }

            await IoHelper.saveFile(filePath, data, "utf-8");
            let imgFolder = filesPath + path.sep + folder + path.sep + "original" + path.sep;
            file.filename = fileName;
            file.folder = imgFolder;
            file.path = filePath;
            Logger.log("trace", "saved file", "FileHelper");
            resolve(file);
        });
    }


    /**
     * 
     * Get the name of all existing collections
     * 
     * @static
     * @returns {String[]} An array of collection names
     * 
     * @memberof FileHelper
     */
    static getAllCollections(): String[] {
        let collections = [];

        let fileInfo: any = IoHelper.readFile(nconf.get("paths:imageInfoFile"));
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
     * @returns {File[]} The array of loaded files
     * 
     * @memberof FileHelper
     */
    static loadCollection(collectionName: string): DivaFile[] {
        let files: DivaFile[] = [];

        let filtered = null;

        filtered = _.filter(this.filesInfo, function (file: any) {
            return file.collection === collectionName;
        });
        if (filtered.length > 0) {
            for (let item of filtered) {
                //let file = DivaFile.CreateFileFull(item.file);
                let file = DivaFile.CreateFileFull(item.file, item.options);
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
     * @param {string} path the path tothe file
     * @param {string} collection the collection the file belongs to
     * 
     * @memberof FileHelper
     */
    static async addFileInfo(path: string, collection: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let mimeType = mime.getType(path);
            let options = {};
            if (!isNullOrUndefined(mimeType) && mimeType.startsWith('image')) {
                options = await FileHelper.getImageInformation(path);
            }
            this.filesInfo.push({ file: path, collection: collection, options: options });
            await this.saveFileInfo();
            resolve();

            /**
            this.filesInfo.push({ file: path, collection: collection });
            await this.saveFileInfo();
            resolve(); */
        });
    }

    /**
     * save the file information file
     * 
     * @static
     * 
     * @memberof FileHelper
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
     * @memberof FileHelper
     */
    static async createCollectionInformation(collectionName: string, files: number) {
        let status = {
            statusCode: 110,
            statusMessage: "Downloaded 0 of " + files + " files",
            percentage: 0,
            totalFiles: files
        };
        await IoHelper.saveFile(nconf.get("paths:filesPath") + path.sep + collectionName + path.sep + "status.json", status, "utf-8");
    }


    /**
     * Add more files to a collection
     * 
     * @static
     * @param {string} collectionName the name of the collection
     * @param {number} newFiles the number of new files
     * @memberof FileHelper
     */
    static async addFilesCollectionInformation(collectionName: string, newFiles: number) {
        let statusFile = nconf.get("paths:filesPath") + path.sep + collectionName + path.sep + "status.json";
        let currentStatus = await IoHelper.readFile(statusFile);

        currentStatus.statusCode = 110;
        currentStatus.statusMessage = "Downloaded " + currentStatus.totalFiles + " of " + (newFiles) + " files";
        currentStatus.percentage = (currentStatus.totalFiles) / (newFiles);
        currentStatus.totalFiles = (newFiles);

        await IoHelper.saveFile(nconf.get("paths:filesPath") + path.sep + collectionName + path.sep + "status.json", currentStatus, "utf-8");
    }


    /**
     * Deletes a collection from DIVAServices
     * 
     * @static
     * @param {string} collection the name of the collection to delete
     * @returns {Promise<void>} 
     * @memberof FileHelper
     */
    static async deleteCollection(collection: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let files: DivaFile[] = this.loadCollection(collection);
            for (var file of files) {
                _.remove(this.filesInfo, function (item: any) {
                    return item.collection === collection;
                });
                Logger.log("info", "delete file" + file.path);
            }
            await this.saveFileInfo();
            await IoHelper.deleteFolder(nconf.get("paths:filesPath") + path.sep + collection);
            resolve();
        });
    }

    /**
     * Removes a single file from DIVAServices
     * 
     * @static
     * @param {DivaFile} file the file to remove
     * @returns {Promise<void>} 
     * @memberof FileHelper
     */
    static async deleteFile(file: DivaFile): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            _.remove(this.filesInfo, function (item: any) {
                return item.collection === file.collection;
            });
            await this.saveFileInfo();
            await IoHelper.deleteFile(file.path);
            resolve();
        });
    }


    /**
     * Removes a file in a collection
     * 
     * @static
     * @param {string} collection the collection the file is in
     * @param {string} target the filename of the file to delete 
     * @returns {Promise<void>} 
     * @memberof FileHelper
     */
    static async deleteFileInCollection(collection: string, target: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let files: DivaFile[] = this.loadCollection(collection);
            for (var file of files) {
                if (file.filename === target) {
                    _.remove(this.filesInfo, function (item: any) {
                        return item.file === file.path;
                    });
                    Logger.log("info", "delete file" + file.path);
                }
            }
            await this.saveFileInfo();
            IoHelper.deleteFile(nconf.get("paths:filesPath") + path.sep + collection + path.sep + "original" + path.sep + target);
            let statusFile = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "status.json";
            let currentStatus = await IoHelper.readFile(statusFile);

            currentStatus.statusCode = 200,
                currentStatus.totalFiles = (currentStatus.totalFiles - 1);
            currentStatus.statusMessage = "Collection is available";
            currentStatus.percentage = 100;
            await IoHelper.saveFile(nconf.get("paths:filesPath") + path.sep + collection + path.sep + "status.json", currentStatus, "utf-8");
            resolve();
        });
    }

    /**
     * Check if a collection exists
     * 
     * @static
     * @param {string} collection the name of the collection
     * @returns {boolean} indicator whether or not the collection exists
     * 
     * @memberof FileHelper
     */
    static checkCollectionAvailable(collection: string): boolean {
        try {
            fs.statSync(nconf.get("paths:filesPath") + path.sep + collection);
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
     * @memberof ImageHelper
     */
    static async updateCollectionInformation(collection: string, files: number, downloaded: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let status = {};
            if (downloaded !== files) {
                status = {
                    statusCode: 110,
                    statusMessage: "Downloaded " + downloaded + " of " + files + " files",
                    percentage: (downloaded / files) * 100,
                    totalFiles: files
                };
            } else {
                status = {
                    statusCode: 200,
                    statusMessage: "Collection is available",
                    percentage: 100,
                    totalFiles: files
                };
            }
            let statusFile = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "status.json";
            await IoHelper.saveFile(statusFile, status, "utf-8");
            resolve();
        });
    }

    /**
     * Get information about a collection
     * 
     * @static
     * @param {string} collection the name of the collection
     * @returns {*} the file information for the collection
     * 
     * @memberof ImageHelper
     */
    static getCollectionInformation(collection: string): any {
        let statusFile = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "status.json";
        return IoHelper.readFile(statusFile);
    }


    /**
     * Get the image information 
     * This function parses the output of imagemagick `identify` function.
     * 
     * @static
     * @param {string} path the path to an input image
     * @returns {Promise<any>} json object with `width` and `height`
     * @memberof FileHelper
     */
    static async getImageInformation(path: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            let result: any = await im.exec('identify -verbose ' + path);
            result = result.stdout.split("\n");
            let options = {};
            for (const line of result) {
                let info = line.trim().split(':');
                switch (info[0].toLowerCase()) {
                    case 'geometry':
                        let dimensions = info[1].split('+')[0].split('x');
                        options['width'] = Number(dimensions[0].replace(' ', ''));
                        options['height'] = Number(dimensions[1].replace(' ', ''));
                        break;
                    case 'colorspace':
                        options['colorspace'] = info[1].replace(' ', '');
                        break;
                    case 'units':
                        options['units'] = info[1].replace(' ', '');
                        break;
                    case 'resolution':
                        options['resolution'] = info[1].replace(' ', '');
                        break;
                    case 'print size':
                        options['print_size'] = info[1].replace(' ', '');
                        break;
                    default:
                        break;
                }
            }
            //TODO Write a parser for the identify result
            resolve(options);
        });
    }
}