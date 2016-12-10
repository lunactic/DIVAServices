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
import * as request from "request";
import { Logger } from "../logging/logger";
import { Process } from "../processingQueue/process";
import { DivaImage } from "../models/divaImage";

/**
 * A class for all image processing function
 * 
 * @export
 * @class ImageHelper
 */
export class ImageHelper {

    /**
     * The JSON object holding all image information
     * 
     * @static
     * 
     * @memberOf ImageHelper
     */
    static imageInfo = JSON.parse(fs.readFileSync(nconf.get("paths:imageInfoFile"), "utf-8"));

    /**
     * saves an image on the filesystem
     * 
     * @static
     * @param {*} inputImage the input image object
     * @param {Process} process the process of this image
     * @param {number} numberOfImages the total number of images to save
     * @param {number} counter the running counter this image is assigned to
     * 
     * @memberOf ImageHelper
     */
    static saveImage(inputImage: any, process: Process, numberOfImages: number, counter: number): void {
        let self = this;
        switch (inputImage.type) {
            case "image":
                this.saveBase64(inputImage.value, process.rootFolder, counter, function (image: DivaImage) {
                    self.addImageInfo(image.md5, image.path, process.rootFolder);
                    self.updateCollectionInformation(process.rootFolder, numberOfImages, counter);
                    Logger.log("trace", "saved image", "ImageHelper");
                });
                break;

            case "url":
                this.saveUrl(inputImage.value, process.rootFolder, counter, function (image: DivaImage) {
                    self.addImageInfo(image.md5, image.path, process.rootFolder);
                    self.updateCollectionInformation(process.rootFolder, numberOfImages, counter);
                });
                break;
        }
    }

    /**
     * Checks if an image exists on the file system
     * 
     * @static
     * @param {string} md5 the md5 hash of the image
     * @param {Function} callback the callback function
     * 
     * @memberOf ImageHelper
     */
    static imageExists(md5: string, callback: Function): void {
        let filtered = this.imageInfo.filter(function (item: any) {
            return item.md5 === md5;
        });
        if (filtered.length > 0) {
            callback(null, { imageAvailable: true, collection: filtered[0].collection });
        } else {
            callback(null, { imageAvailable: false });
        }
    }

    /**
     * Saves an image based on its base64 encoding
     * 
     * @static
     * @param {*} image the image object containing the base64 string
     * @param {string} folder the folder to save the image into
     * @param {number} counter the running counter applied to this image
     * @param {Function} callback the callback function
     * 
     * @memberOf ImageHelper
     */
    static saveBase64(image: any, folder: string, counter: number, callback: Function) {
        let imagePath = nconf.get("paths:imageRootPath");
        let base64Data = image.value.replace(/^data:image\/png;base64,/, "");
        let md5String = md5(base64Data);

        let imageObject = new DivaImage();
        let imgFolder = imagePath + path.sep + folder + path.sep + "original" + path.sep;
        let imgName = "input" + counter;
        let imgExtension = this.getImageExtensionBase64(base64Data);
        fs.stat(imgFolder + imgName, function (err: any, stat: fs.Stats) {
            imageObject.rootFolder = path.join(path.dirname(imgFolder), "..");
            imageObject.folder = imgFolder;
            imageObject.name = imgName;
            imageObject.extension = imgExtension;
            imageObject.path = imgFolder + imgName + "." + imgExtension;
            imageObject.md5 = md5String;
            if (err === null) {
                return image;
            } else if (err.code === "ENOENT") {
                fs.writeFile(imageObject.path, base64Data, "base64", function (err: any) {
                    callback(imageObject);
                });
            } else {
                Logger.log("error", "error saving the image", "ImageHelper");
            }
        });
    }

    /**
     * Saves an image stored within a JSON object
     * 
     * @static
     * @param {*} image the JSON object of the image
     * @param {Process} process the process of this image
     * @param {string} filename the filename of this image
     * 
     * @memberOf ImageHelper
     */
    static saveJson(image: any, process: Process, filename: string) {
        process.image.extension = this.getImageExtensionBase64(image);
        let base64Data = image.replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync(process.outputFolder + path.sep + filename + "." + process.image.extension, base64Data, "base64");
    }

    /**
     * Download an image from a URL and save it on the filesystem
     * 
     * @static
     * @param {string} url the remote url of the image
     * @param {string} folder the local folder to store the image in
     * @param {number} counter the running counter that is assigned to this image
     * @param {Function} cb the callback function
     * 
     * @memberOf ImageHelper
     */
    static saveUrl(url: string, folder: string, counter: number, cb: Function) {
        let imagePath = nconf.get("paths:imageRootPath");
        let image = new DivaImage();
        async.waterfall([
            function (callback: Function) {
                request.head(url).on("response", function (response: any) {
                    let imageExtension = this.getImageExtension(response.headers["content-type"]);
                    callback(null, imageExtension);
                });
            }, function (imgExtension: string, callback: Function) {
                request(url).pipe(fs.createWriteStream(imagePath + "temp_" + counter + "." + imgExtension)).on("close", function (cb: Function) {
                    let base64 = fs.readFileSync(imagePath + "temp_" + counter + "." + imgExtension, "base64");
                    let md5String = md5(base64);
                    let imgFolder = imagePath + "original" + path.sep;
                    let imgName = "input" + counter;
                    image.rootFolder = path.join(path.dirname(imgFolder), "..");
                    image.folder = imgFolder;
                    image.extension = imgExtension;
                    image.path = imgFolder + imgName + "." + imgExtension;
                    image.md5 = md5String;

                    fs.stat(image.path, function (err: any, stat: fs.Stats) {
                        if (err != null) {
                            fs.unlink(imagePath + "temp_" + counter + "." + imgExtension);
                            callback(null, image);
                        } else if (err.code === "ENONENT") {
                            let source = fs.createReadStream(imagePath + "temp_" + counter + "." + imgExtension);
                            let destination = fs.createWriteStream(image.path);
                            source.pipe(destination);
                            source.on("end", function () {
                                fs.unlink(imagePath + "temp_" + counter + "." + imgExtension);
                                callback(null, image);
                            });
                            source.on("error", function (error: any) {
                                Logger.log("error", JSON.stringify(error), "ImageHelper");
                                callback(null, image);
                            });
                        }
                    });
                });
            }
        ], function (err: any, image: DivaImage) {
            if (err != null) {
                Logger.log("error", JSON.stringify(err), "ImageHelper");
            } else {
                cb(image);
            }
        });
    }

    /**
     * load all images with the same md5 hash
     * 
     * @static
     * @param {string} md5 the md5 hash of the image
     * @returns {DivaImage[]} An array of images
     * 
     * @memberOf ImageHelper
     */
    static loadImagesMd5(md5: string): DivaImage[] {
        let filtered = this.imageInfo.filter(function (item: DivaImage) {
            return item.md5 === md5;
        });
        let images: DivaImage[] = [];
        let sync: boolean = false;

        for (let i = 0; i < filtered.length; i++) {
            let item = filtered[i];
            let imagePath = item.file;
            let image: DivaImage = new DivaImage();
            image.rootFolder = path.join(path.dirname(imagePath), "..");
            image.folder = path.dirname(imagePath);
            image.extension = path.extname(imagePath).substring(1);
            image.name = path.basename(imagePath, image.extension);
            image.path = imagePath;
            image.md5 = md5;
            images.push(image);
        }
        sync = true;
        return images;


    }

    /**
     * 
     * Get the name of all existing collections
     * 
     * @static
     * @returns {String[]} An array of collection names
     * 
     * @memberOf ImageHelper
     */
    static getAllCollections(): String[] {
        let collections = [];

        let imageInfo: any = IoHelper.loadFile(nconf.get("paths:imageInfoFile"));
        _.forEach(imageInfo, function (image: any) {
            if (!(collections.indexOf(image.collection) > -1)) {
                collections.push(image.collection);
            }
        });

        return collections;
    }

    /**
     * Load specific images of a collection
     * 
     * @static
     * @param {string} collectionName The name of the collection
     * @param {string[]} hashes an array of md5 hashes for images to load
     * @returns {DivaImage[]} The array of loaded images
     * 
     * @memberOf ImageHelper
     */
    static loadCollection(collectionName: string, hashes: string[]): DivaImage[] {
        let imagePath = nconf.get("paths:imageRootPath");
        let imageFolder = imagePath + path.sep + collectionName + path.sep;
        let images: DivaImage[] = [];

        let filtered = null;

        if (hashes != null) {
            filtered = _.filter(this.imageInfo, function (image: any) {
                return image.collection === collectionName && _.includes(hashes, image.md5);
            });
        } else {
            filtered = _.filter(this.imageInfo, function (image: any) {
                return image.collection === collectionName;
            });
        }
        if (filtered.length > 0) {
            for (let item of filtered) {
                let image = new DivaImage();
                image.folder = imageFolder;
                image.name = path.basename(item.file).split(".")[0];
                image.extension = path.extname(item.file).replace(".", "");
                image.path = item.file;
                image.md5 = item.md5;
                images.push(image);
            }
            return images;
        } else {
            Logger.log("error", "Tried to load collection: " + collectionName + " which does not exist", "ImageHelper");
            return [];
        }
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
    static addImageInfo(md5: string, file: string, collection: string): void {
        this.imageInfo.push({ md5: md5, file: file, collection: collection });
        this.saveImageInfo();
    }

    /**
     * get information for an image
     * 
     * @static
     * @param {string} md5 the md5 hash of the image
     * @returns {*} the information belonging to this image
     * 
     * @memberOf ImageHelper
     */
    static getImageInfo(md5: string): any {
        return _.find(this.imageInfo, function (info: any) {
            return info.md5 === md5;
        });
    }

    /**
     * save the image information file
     * 
     * @static
     * 
     * @memberOf ImageHelper
     */
    static saveImageInfo(): void {
        IoHelper.saveFile(nconf.get("paths:imageInfoFile"), this.imageInfo, "utf-8", null);
    }


    /**
     * create the information for a collection
     * 
     * @static
     * @param {string} collectionName the name of the collection
     * @param {number} images the number of images belonging to this collection
     * 
     * @memberOf ImageHelper
     */
    static createCollectionInformation(collectionName: string, images: number): void {
        let status = {
            statusCode: 110,
            statusMessage: "Downloaded 0 of " + images + " images",
            percentage: 0
        };
        IoHelper.saveFile(nconf.get("paths:imageRootPath") + path.sep + collectionName + path.sep + "status.json", status, "utf-8", null);
    }

    /**
     * Check if a collection exists
     * 
     * @static
     * @param {string} collection the name of the collection
     * @returns {boolean} indicator wheter or not the collection exists
     * 
     * @memberOf ImageHelper
     */
    static checkCollectionAvailable(collection: string): boolean {
        try {
            let stats = fs.statSync(nconf.get("paths:imageRootPath") + path.sep + collection);
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
     * @param {number} images the total number of images in the collection
     * @param {number} downloaded the number of downloaded images
     * 
     * @memberOf ImageHelper
     */
    static updateCollectionInformation(collection: string, images: number, downloaded: number): void {
        let status = {};
        if (downloaded !== images) {
            status = {
                statusCode: 110,
                statusMessage: "Downloaded " + downloaded + " of " + images + " images",
                percentage: (downloaded / images) * 100
            };
        } else {
            status = {
                statusCode: 200,
                statusMessage: "Collection is available",
                percentage: 100
            };
        }
        let statusFile = nconf.get("paths:imageRootPath") + path.sep + collection + path.sep + "status.json";
        IoHelper.saveFile(statusFile, status, "utf-8", null);
    }

    /**
     * Get information about a collection
     * 
     * @static
     * @param {string} collection the name of the collection
     * @returns {*} the image information for the collection
     * 
     * @memberOf ImageHelper
     */
    static getCollectionInformation(collection: string): any {
        let statusFile = nconf.get("paths:imageRootPath") + path.sep + collection + path.sep + "status.json";
        return IoHelper.loadFile(statusFile);
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
    static getImageExtension(contentType: string): string {
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