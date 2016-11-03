export declare class IoHelper {
    static fileExists(filePath: string): boolean;
    static loadFile(filePath: string): any;
    static saveFile(filePath: string, content: any, encoding: string, callback: Function): void;
    static deleteFile(file: string): void;
    static deleteFolder(folder: string): void;
    static downloadFile(fileUrl: string, localFolder: string, fileType: string, callback: Function): void;
    static zipFolder(folder: string): string;
    static unzipFile(zipFile: string, folder: string, callback: Function): void;
    static readFolder(path: string): string[];
    static createDataCollectionFolders(service: any): void;
    static createImageCollectionFolders(collection: string): void;
    static deleteImageCollectionFolders(collection: string): void;
    static getOutputFolderForData(service: any, unique: boolean): string;
    static getOutputFolderForImages(rootFolder: string, service: any, unique: boolean): string;
    private static getOutputFolder(rootPath, service, unique);
    static buildResultfilePath(folder: string, fileName: string): string;
    static buildTempResultfilePath(folder: string, fileName: string): string;
    static getStaticImageUrl(folder: string, filename: string): string;
    static getStaticDataUrl(folder: string, filename: string): string;
    static getStaticImageUrlWithExt(folder: string, filename: string, extension: string): string;
    static getStaticDataUrlRelative(relativeFilePath: string): string;
    static getStaticImageUrlRelative(relativeFilePath: string): string;
    static getStaticDataUrlFull(fullFilePath: string): string;
    static getStaticImageUrlFull(fullFilePath: string): string;
    static checkFileType(fileType: string, fileUrl: string, callback: Function): void;
}
