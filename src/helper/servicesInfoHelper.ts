/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import * as _ from "lodash";
import * as nconf from "nconf";
import {IoHelper} from "./ioHelper";

export class ServicesInfoHelper {

    static fileContent = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));

    static getInfoByPath(path: string): any {
        this.reload();
        let serviceInfo = this.fileContent.services.filter(function (item: any) {
            return item.path === path;
        });

        return serviceInfo[0];
    }

    static getInfoByName(name: string): any {
        this.reload();
        let serviceInfo = this.fileContent.filter(function (item: any) {
            return item.service === name;
        });
        return serviceInfo[0];
    }

    static getInfoByIdentifier(identifier: string): any {
        this.reload();
        let serviceInfo = this.fileContent.filter(function (item: any) {
            return item.identifier === identifier;
        });
        return serviceInfo[0];
    }

    static update(newData: any): void {
        IoHelper.saveFile(nconf.get("paths:servicesInfoFile"), newData, "utf8", null);
    }

    static reload(): void {
        this.fileContent = IoHelper.loadFile(nconf.get("paths:servicesInfoFile"));
    }

    static methodRequireFiles(serviceInfo: any): boolean {
        let fileParameters = _.filter(serviceInfo.parameters, function(parameter: string){
           return _.keys(parameter)[0] in ["inputImage", "inputFile"];
        });

        return fileParameters.length > 0;
    }

    static methodRequireData(serviceInfo: any) : boolean {
        let fileParameters = _.filter(serviceInfo.parameters, function(parameter: string){
            return _.keys(parameter)[0] in ["json"];
        });
        return fileParameters.length > 0;
    }
}