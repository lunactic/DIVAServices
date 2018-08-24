/**
 * Created by Marcel Würsch on 02.11.16.
 */
"use strict";

import * as nconf from "nconf";
import { DivaError } from "../models/divaError";
import { IoHelper } from "./ioHelper";

/**
 * helper class for all service information
 * 
 * @export
 * @class ServicesInfoHelper
 */
export class ServicesInfoHelper {

    /**
     * the content of the service information file
     * 
     * @static
     * 
     * @memberof ServicesInfoHelper
     */
    static fileContent = IoHelper.readFile(nconf.get("paths:servicesInfoFile"));

    /**
     * get service information for a route
     * 
     * @static
     * @param {string} path the route to check
     * @returns {*} the service information
     * 
     * @memberof ServicesInfoHelper
     */
    static async getInfoByPath(path: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            await this.reload();
            let serviceInfo = this.fileContent.services.filter(function (item: any) {
                return item.path === path;
            });
            if (serviceInfo.length === 0) {
                reject(new DivaError("Could not find method: " + path, 500, "MethodNotFound"));
                return;
            } else {
                resolve(serviceInfo[0]);
            }
        });
    }

    /**
     * get service information for a method
     * 
     * @static
     * @param {string} name the name of the method
     * @returns {*} the service information
     * 
     * @memberof ServicesInfoHelper
     */
    static async getInfoByName(name: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            await this.reload();
            let serviceInfo = this.fileContent.services.filter(function (item: any) {
                return item.service === name;
            });
            resolve(serviceInfo[0]);
        });
    }

    /**
     * get service information based on a method identifier
     * 
     * @static
     * @param {string} identifier the identifier
     * @returns {*} the service information
     * 
     * @memberof ServicesInfoHelper
     */
    static async getInfoByIdentifier(identifier: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            await this.reload();
            let serviceInfo = this.fileContent.services.filter(function (item: any) {
                return item.identifier === identifier;
            });
            resolve(serviceInfo[0]);
        });

    }

    /**
    * update the service information file
    * 
    * @static
    * @param {*} newData the new service information object
    * 
    * @memberof ServicesInfoHelper
    */
    static async update(newData: any): Promise<void> {
        await IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), newData, "utf8");
    }

    /**
     * reload the content of the service information
     * 
     * @static
     * 
     * @memberof ServicesInfoHelper
     */
    static async reload(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.fileContent = IoHelper.readFile(nconf.get("paths:servicesInfoFile"));
            resolve();
        });
    }
}