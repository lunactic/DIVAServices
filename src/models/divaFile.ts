/**
 * Created by Marcel Würsch on 03.11.16.
 */

import * as nconf from "nconf";
import * as path from "path";
/**
 * class representing an internal data item
 * 
 * @export
 * @class DivaFile
 */
export class DivaFile {

    /**
     * the folder name of the file on the filesystem
     * 
     * @type {string}
     * @memberof File
     */
    private _folder: string;
    /**
     * the name of the file
     * 
     * @type {string}
     * @memberof File
     */
    private _filename: string;

    /**
     * the DIVAServices identifier of the file 
     * 
     * @type {string}
     * @memberof DivaFile
     */
    private _identifier: string;

    /**
     * the name of the collection
     * @type {string}
     * @memberof File
     */
    private _collection: string;

    /**
     * the file extension
     * 
     * @type {string}
     * @memberof File
     */
    private _extension: string;
    /**
     * the full path to the data file
     * 
     * @type {string}
     * @memberof File
     */
    private _path: string;

    /**
     * the public url to retrieve this file
     * 
     * @type {string}
     * @memberof DivaFile
     */
    private _url: string;

    /**
     * Additional information on a file
     *
     * @type {*}
     * @memberof DivaFile
     */
    private _options: any;

    /**
     * Creates an instance of DivaFile.
     * @memberof DivaFile
     */
    constructor() {
        this.folder = "";
        this.filename = "";
        this.extension = "";
        this.path = "";
        this.identifier = "";
    }

    /**
     * Create a DivaFile for a specific data item in a collection
     * 
     * @static
     * @param {string} collection the collection containing the file
     * @param {string} filename  the filename of the file
     * @returns {DivaFile} The created DivaFile
     * @memberof DivaFile
     */
    static CreateFile(collection: string, filename: string): DivaFile {
        let item = new DivaFile();
        item.collection = collection;
        item.filename = filename;
        item.extension = filename.split(".").pop();
        item.path = nconf.get("paths:filesPath") + path.sep + collection + path.sep + "original" + path.sep + filename;
        item.identifier = item.path.replace(nconf.get("paths:filesPath") + path.sep, "").replace(path.sep + "original", "");
        item.url = "http://" + nconf.get("server:rootUrl") + "/files/" + collection + "/original/" + filename;
        return item;
    }
    /**
     * Create a DivaFile from a full path to the file
     * 
     * @static
     * @param {string} filePath The path to the file 
     * @param {*} [options] additional information
     * @returns {DivaFile} The created DivaFile
     * @memberof DivaFile
     */
    static CreateFileFull(filePath: string, options?: any): DivaFile {
        let item = new DivaFile();
        let relativePath = filePath.replace(nconf.get("paths:filesPath") + path.sep, "");
        item.path = filePath;
        item.identifier = relativePath.replace(path.sep + "original", "");
        item.url = "http://" + nconf.get("server:rootUrl") + "/files/" + relativePath;
        item.filename = path.parse(filePath).base;
        item.extension = path.parse(filePath).ext;
        item.options = options;
        return item;

    }
    /**
     * Create a DivaFile used in testing with a full path to the file
     * 
     * @static
     * @param {string} filePath The path to the file
     * @returns {DivaFile} The created DivaFile
     * @memberof DivaFile
     */
    static CreateFileFullTest(filePath: string): DivaFile {
        let relativePath = filePath.replace(nconf.get("paths:executablePath") + path.sep, "");
        let item = new DivaFile();
        item.path = filePath;
        item.url = "http://" + nconf.get("server:rootUrl") + "/test/" + relativePath;
        item.filename = path.parse(filePath).base;
        item.extension = path.parse(filePath).ext;
        item.identifier = relativePath.replace(path.sep + "original", "");
        return item;
    }


    /**
     * Getter folder
     * @return {string}
     */
	public get folder(): string {
		return this._folder;
	}

    /**
     * Getter filename
     * @return {string}
     */
	public get filename(): string {
		return this._filename;
	}

    /**
     * Getter identifier
     * @return {string}
     */
	public get identifier(): string {
		return this._identifier;
	}

    /**
     * Getter collection
     * @return {string}
     */
	public get collection(): string {
		return this._collection;
	}

    /**
     * Getter extension
     * @return {string}
     */
	public get extension(): string {
		return this._extension;
	}

    /**
     * Getter path
     * @return {string}
     */
	public get path(): string {
		return this._path;
	}

    /**
     * Getter url
     * @return {string}
     */
	public get url(): string {
		return this._url;
	}

    /**
     * Getter options
     * @return {any}
     */
	public get options(): any {
		return this._options;
	}

    /**
     * Setter folder
     * @param {string} value
     */
	public set folder(value: string) {
		this._folder = value;
	}

    /**
     * Setter filename
     * @param {string} value
     */
	public set filename(value: string) {
		this._filename = value;
	}

    /**
     * Setter identifier
     * @param {string} value
     */
	public set identifier(value: string) {
		this._identifier = value;
	}

    /**
     * Setter collection
     * @param {string} value
     */
	public set collection(value: string) {
		this._collection = value;
	}

    /**
     * Setter extension
     * @param {string} value
     */
	public set extension(value: string) {
		this._extension = value;
	}

    /**
     * Setter path
     * @param {string} value
     */
	public set path(value: string) {
		this._path = value;
	}

    /**
     * Setter url
     * @param {string} value
     */
	public set url(value: string) {
		this._url = value;
	}

    /**
     * Setter options
     * @param {any} value
     */
	public set options(value: any) {
		this._options = value;
	}

}