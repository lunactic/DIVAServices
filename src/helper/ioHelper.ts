import { resolve } from 'dns';
/**
 * Created by lunactic on 02.11.16.
 */


"use strict";

import * as _ from "lodash";
import * as archiver from "archiver";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as fse from "fs-extra";
import * as nconf from "nconf";
import * as path from "path";
;
let rmdir = require("rmdir");
let unzip = require("unzip");
import * as url from "url";
import { Logger } from "../logging/logger";

/**
 * Class handling all input/output
 * 
 * @export
 * @class IoHelper
 */
export class IoHelper {

    /**
     * checks if a file exists on the filesystem
     * 
     * @static
     * @param {string} filePath path of the file
     * @returns {boolean} boolean indicating wheter or not the file exists
     * 
     * @memberOf IoHelper
     */
    static fileExists(filePath: string): boolean {
        try {
            let stats = fs.statSync(filePath);
            return stats.isFile();
        } catch (error) {
            return false;
        }
    }

    /**
     * open a file a return its content
     * 
     * @static
     * @param {string} filePath the path of the file to open
     * @returns {*} the content of the file as JSON object
     * 
     * @memberOf IoHelper
     */
    static openFile(filePath: string): any {
        try {
            let stats = fs.statSync(filePath);
            if (stats.isFile()) {
                let content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                return content;
            } else {
                return null;
            }
        } catch (error) {
            Logger.log("error", "Could not read file: " + filePath, "IoHelper");
            return null;
        }
    }

    /**
     * save a file on the filesystem
     * 
     * @static
     * @param {string} filePath the file path
     * @param {*} content the content as JSON object
     * @param {string} encoding the encoding to use
     * @param {Function} [callback] the callback function
     * 
     * @memberOf IoHelper
     */
    static async saveFile(filePath: string, content: any, encoding: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {

            try {
                fs.writeFileSync(filePath, JSON.stringify(content, null, "\t"), encoding);
                resolve();
            } catch (error) {
                Logger.log("error", "Could not write file due to error " + error, "IoHelper");
                reject(error);
            }
        });
    }

    /**
     * remove a file from the filesystem
     * 
     * @static
     * @param {string} file the file path to remove
     * 
     * @memberOf IoHelper
     */
    static async deleteFile(file: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            try{
                fs.unlinkSync(file);
                resolve();
            }catch(error){
                reject(error);
            }
        });
    }

    /**
     * create a folder on the filesystem (uses mkdir -p)
     * 
     * @static
     * @param {string} folder the folder to create
     * 
     * @memberOf IoHelper
     */
    static createFolder(folder: string): void {
        fse.mkdirsSync(folder);
    }

    /**
     * remove a folder from the filesystem (removes content too)
     * 
     * @static
     * @param {string} folder the folder to remove
     * 
     * @memberOf IoHelper
     */
    static deleteFolder(folder: string): void {
        rmdir(folder, function () {
            Logger.log("info", "successfully deleted folder: " + folder, "IoHelper");
        });
    }

    /**
     * Download a file synchronously
     * 
     * @static
     * @param {string} fileUrl the file to download
     * @param {string} localFolder the local folder to save the file into
     * @param {any} localFilename the filename to assign the downloaded image
     * @returns {string} the full path to the file
     * 
     * @memberOf IoHelper
     */
    static downloadFileSync(fileUrl: string, localFolder: string, localFilename): string {
        http.get(fileUrl, function (response: http.IncomingMessage) {
            response.pipe(fs.createWriteStream(localFolder + path.sep + localFilename));
        });
        return localFolder + path.sep + localFilename;
    }

    /**
     * Download a file asynchronously with an additional check if the filetype is correct
     * Performs a HTTP HEAD request to check the file type
     * 
     * @static
     * @param {string} fileUrl the remote url to download
     * @param {string} localFolder the local folder to save the file into
     * @param {string} fileType the expected file type
     * @param {Function} callback the callback function
     * 
     * @memberOf IoHelper
     */
    static downloadFileWithTypecheck(fileUrl: string, localFolder: string, fileType: string, callback: Function): void {
        this.checkFileType(fileType, fileUrl, function (error: any) {
            if (error != null) {
                callback(error);
            } else {
                let filename = path.basename(url.parse(fileUrl).pathname);
                let file = fs.createWriteStream(localFolder + path.sep + filename);
                switch (url.parse(fileUrl).protocol) {
                    case "http:":
                        http.get(fileUrl, function (response: http.IncomingMessage) {
                            response.pipe(file);
                            response.on("end", function () {
                                callback(null, localFolder + path.sep + filename);
                            });
                        });
                        break;
                    case "https":
                        https.get(fileUrl, function (response: http.IncomingMessage) {
                            response.pipe(file);
                            response.on("end", function () {
                                callback(null, localFolder + path.sep + filename);
                            });
                        });
                        break;
                }
            }
        });
    }

    /**
     * Create a zip file from a folder
     * 
     * @static
     * @param {string} folder the folder to compress
     * @returns {string} the filename of the compressed zip file
     * 
     * @memberOf IoHelper
     */
    static zipFolder(folder: string): string {
        let archive = archiver("zip", {});
        let folders = folder.split(path.sep);

        let fullFileName = nconf.get("paths:imageRootPath") + path.sep + folders[folders.length - 2] + "_" + folders[folders.length - 1] + ".zip";
        let fileName = folders[folders.length - 2] + "_" + folders[folders.length - 1] + ".zip";

        let output = fs.createWriteStream(fullFileName);
        output.on("close", function () {
            return;
        });
        archive.on("error", function (error: Object) {
            Logger.log("error", JSON.stringify(error), "IoHelper");
        });

        archive.pipe(output);
        archive.bulk([{
            expand: true,
            cwd: folder + path.sep,
            src: ["*.png", "**/*.png"]
        }]);
        archive.finalize();
        return fileName;
    }

    /**
     * unzip a compressed file
     * 
     * @static
     * @param {string} zipFile the path to the compressed file
     * @param {string} folder the folder to uncompress the files into
     * @param {Function} callback the callback function
     * 
     * @memberOf IoHelper
     */
    static unzipFile(zipFile: string, folder: string, callback: Function): void {

        fse.mkdirs(folder, function (error: Error) {
            if (error) {
                Logger.log("error", JSON.stringify(error), "IoHelper");
                callback(error);
            } else {
                let reader = fs.createReadStream(zipFile);
                reader.pipe(unzip.Extract({ path: folder })).on("close", function () {
                    callback(null);
                });
            }
        });
    }

    /**
     * read all files in a folder
     * 
     * @static
     * @param {string} path the folder to read the files from
     * @returns {string[]} an array of files within the folder
     * 
     * @memberOf IoHelper
     */
    static readFolder(path: string): string[] {
        try {
            let files = fs.readdirSync(path);
            return files;
        } catch (error) {
            return null;
        }
    }

    /**
     * Create the local folder for an image collection
     * 
     * @static
     * @param {string} collection the name of the collection
     * 
     * @memberOf IoHelper
     */
    static createFilesCollectionFolders(collection: string): void {
        let rootFolder = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "original";
        fse.mkdirpSync(rootFolder);
    }

    /**
     * remove the collection folder for an image collection
     * 
     * @static
     * @param {string} collection the name of the collection
     * 
     * @memberOf IoHelper
     */
    static deleteImageCollectionFolders(collection: string): void {
        let rootFolder = nconf.get("paths:imageRootPath") + path.sep + collection + path.sep;
        rmdir(rootFolder, function (error: any) {
            if (error != null) {
                Logger.log("error", JSON.stringify(error), "IoHelper");
            }
        });
    }

    /**
     * get the output folder for a data collection
     * 
     * @static
     * @param {string} collectionName the name of the collection
     * @returns {string} the path of the folder
     * 
     * @memberOf IoHelper
     */
    static getOutputFolder(collectionName: string): string {
        let dataPath = nconf.get("paths:resultsPath");
        let rootPath = dataPath + path.sep + collectionName;
        return rootPath;
    }

    /**
     * compute the path for the result file
     * 
     * @static
     * @param {string} folder the folder name
     * @param {string} fileName the file name
     * @returns {string} the path of the result file
     * 
     * @memberOf IoHelper
     */
    static buildResultfilePath(folder: string, fileName: string): string {
        return folder + fileName + ".json";
    }

    /**
     * compute the temporary result file path
     * 
     * @static
     * @param {string} folder the folder name
     * @param {string} fileName the file name
     * @returns {string} the path of the temporary file
     * 
     * @memberOf IoHelper
     */
    static buildTempResultfilePath(folder: string, fileName: string): string {
        return folder + fileName + "_temp.json";
    }

    /**
     * get the static url for an image
     * 
     * @static
     * @param {string} folder the folder of the image
     * @param {string} filename the filename of the image
     * @returns {string} the static url to access this image
     * 
     * @memberOf IoHelper
     */
    static getStaticImageUrl(folder: string, filename: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/images/" + folder + "/" + filename;
    }

    /**
     * get the static image url with a specific extension
     * 
     * @static
     * @param {string} folder the folder name
     * @param {string} filename the file name
     * @param {string} extension the image extension
     * @returns {string} the static url to access this image
     * 
     * @memberOf IoHelper
     */
    static getStaticImageUrlWithExt(folder: string, filename: string, extension: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/images/" + folder + "/" + filename + "." + extension;
    }

    /**
     * get the static url to an image from a relative path
     *
     * @static
     * @param {string} relativeFilePath the relative path to the image
     * @returns {string} the static url to access this image
     *
     * @memberOf IoHelper
     */
    static getStaticImageUrlRelative(relativeFilePath: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/images/" + relativeFilePath;
    }

    /**
     * get the static url to an image from a relative path
     *
     * @static
     * @param {string} relativeFilePath the relative path to the image
     * @returns {string} the static url to access this image
     *
     * @memberOf IoHelper
     */
    static getStaticResultUrlRelative(relativeFilePath: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/results/" + relativeFilePath;
    }

    /**
     * Get the static url to an image from its absolute path
     * 
     * @static
     * @param {string} fullFilePath the absolute path to the image
     * @returns {string} the static url to access this image
     * 
     * @memberOf IoHelper
     */
    static getStaticResultUrlFull(fullFilePath: string): string {
        let relPath = fullFilePath.replace(nconf.get("paths:resultPath") + path.sep, "");
        return this.getStaticResultUrlRelative(relPath);
    }

    /**
     * Checks if the file type of a remote url matches the expected type
     * 
     * @static
     * @param {string} fileType the expected file type
     * @param {string} fileUrl the remote url 
     * @param {Function} callback the callback function
     * 
     * @memberOf IoHelper
     */
    static checkFileType(fileType: string, fileUrl: string, callback: Function): void {
        if (fileType != null && fileType.length > 0) {
            let urlInfo = url.parse(fileUrl);
            let options = {
                method: "HEAD",
                hostname: urlInfo.hostname,
                path: urlInfo.path,
                port: parseInt(urlInfo.port)
            };

            let req = http.request(options, function (response: http.IncomingMessage) {
                if (response.headers["content-type"] !== fileType) {
                    Logger.log("error", "non matching file type", "IoHelper");
                    callback({ error: "non matching file type" });
                } else {
                    Logger.log("info", "downloaded file: " + fileUrl, "IoHelper");
                    callback(null);
                }
            });
            req.end();
        } else {
            Logger.log("error", "no filetype provided", "IoHelper");
            callback(null);
        }

    }

}