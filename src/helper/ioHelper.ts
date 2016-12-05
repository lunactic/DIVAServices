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
import {Logger} from "../logging/logger";

export class IoHelper {


    static fileExists(filePath: string): boolean {
        try {
            let stats = fs.statSync(filePath);
            return stats.isFile();
        } catch (error) {
            return false;
        }
    }

    static loadFile(filePath: string): any {
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

    static saveFile(filePath: string, content: any, encoding: string, callback: Function) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(content, null, "\t"), encoding);
            if (callback != null) {
                callback(null);
            }
        } catch (error) {
            Logger.log("error", "Could not write file due to error " + error, "IoHelper");
        }
    }


    static deleteFile(file: string): void {
        fs.unlink(file);
    }

    static createFolder(folder: string): void {
        fse.mkdirsSync(folder);
    }

    static deleteFolder(folder: string): void {
        rmdir(folder, function () {
            Logger.log("info", "successfully deleted folder: " + folder, "IoHelper");
        });
    }


    static downloadFileSync(fileUrl: string, localFolder: string, localFilename): string {
        http.get(fileUrl, function (response: http.IncomingMessage) {
            response.pipe(fs.createWriteStream(localFolder + path.sep + localFilename));
        });
        //IoHelper.saveFile(localFolder + path.sep + localFilename, res.getBody("utf8").toString(), "utf8", null);
        return localFolder + path.sep + localFilename;
    }

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

    static unzipFile(zipFile: string, folder: string, callback: Function): void {

        fse.mkdirs(folder, function (error: Error) {
            if (error) {
                Logger.log("error", JSON.stringify(error), "IoHelper");
                callback(error);
            } else {
                let reader = fs.createReadStream(zipFile);
                reader.pipe(unzip.Extract({path: folder})).on("close", function () {
                    callback(null);
                });
            }
        });
    }

    static readFolder(path: string) {
        try {
            let files = fs.readdirSync(path);
            return files;
        } catch (error) {
            return null;
        }
    }

    static createDataCollectionFolders(service: any): void {
        let rootFolder = nconf.get("paths:dataRootPath") + path.sep + service.service + path.sep + "original";
        fse.mkdirs(rootFolder, function (error: Error) {
            if (error != null) {
                Logger.log("error", JSON.stringify(error), "IoHelper");
            }
        });
    }

    static createImageCollectionFolders(collection: string): void {
        let rootFolder = nconf.get("paths:imageRootPath") + path.sep + collection + path.sep + "original";
        fse.mkdirsSync(rootFolder);

    }

    static deleteImageCollectionFolders(collection: string): void {
        let rootFolder = nconf.get("paths:imageRootPath") + path.sep + collection + path.sep;
        rmdir(rootFolder, function (error: any) {
            if (error != null) {
                Logger.log("error", JSON.stringify(error), "IoHelper");
            }
        });
    }

    static getOutputFolderForData(service: any, unique: boolean): string {
        let dataPath = nconf.get("paths:dataRootPath");
        let rootPath = dataPath + path.sep + service.service;
        return IoHelper.getOutputFolder(rootPath, service, unique);

    }

    static getOutputFolderForImages(rootFolder: string, service: any, unique: boolean): string {
        let imagePath = nconf.get("paths:imageRootPath");
        let rootPath = imagePath + path.sep + rootFolder;
        return IoHelper.getOutputFolder(rootPath, service, unique);
    }

    private static getOutputFolder(rootPath: string, service: any, unique: boolean): string {
        let folders = fs.readdirSync(rootPath).filter(function (file: any) {
            return fs.statSync(path.join(rootPath, file)).isDirectory();
        });
        folders = _.filter(folders, function (folder: any) {
            return _.includes(folder, service.service);
        });

        if (folders.length > 0 && !unique) {
            let splitFolders = _.invokeMap(folders, String.prototype.split, "_");
            let numbers: number[] = _.forEach(splitFolders, function (number: any) {
                return parseInt(number[1]);
            });
            let maxNumber: number = _.max(numbers);
            return rootPath + path.sep + service.service + "_" + (maxNumber + 1);
        } else {
            return rootPath + path.sep + service.service + "_0";
        }
    }

    static buildResultfilePath(folder: string, fileName: string): string {
        return folder + path.sep + fileName + ".json";
    }

    static buildTempResultfilePath(folder: string, fileName: string): string {
        return folder + path.sep + fileName + "_temp.json";
    }

    static getStaticImageUrl(folder: string, filename: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/images/" + folder + "/" + filename;
    }

    static getStaticDataUrl(folder: string, filename: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/data/" + folder + "/" + filename;
    }

    static getStaticImageUrlWithExt(folder: string, filename: string, extension: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/images/" + folder + "/" + filename + "." + extension;
    }

    static getStaticDataUrlRelative(relativeFilePath: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/data/" + relativeFilePath;
    }

    static getStaticImageUrlRelative(relativeFilePath: string): string {
        let rootUrl = nconf.get("server:rootUrl");
        return "http://" + rootUrl + "/images/" + relativeFilePath;
    }

    static getStaticDataUrlFull(fullFilePath: string): string {
        let relPath = fullFilePath.replace(nconf.get("paths:dataRootPath") + path.sep, "");
        return this.getStaticDataUrlRelative(relPath);
    }

    static getStaticImageUrlFull(fullFilePath: string): string {
        let relPath = fullFilePath.replace(nconf.get("paths:imageRootPath") + path.sep, "");
        return this.getStaticImageUrlRelative(relPath);
    }

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
                    callback({error: "non matching file type"});
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