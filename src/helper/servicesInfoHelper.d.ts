declare class ServicesInfoHelper {
    static fileContent: any;
    static getInfoByPath(path: string): any;
    static getInfoByName(name: string): any;
    static getInfoByIdentifier(identifier: string): any;
    static update(newData: any): void;
    static reload(): void;
    static methodRequireFiles(serviceInfo: any): boolean;
    static methodRequireData(serviceInfo: any): boolean;
}
export = ServicesInfoHelper;
