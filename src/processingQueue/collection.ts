/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

/**
 * Class represanting a collection
 */
class Collection {
    public static method: string = "";
    public static name: string  = "";
    public static outputLink: string  = "";
    public static outputFolder: string  = "";
    public static inputParameters = {};
    public static inputHighlighters = {};
    public static neededParameters = {};
    public static parameters = null;
    public static image = {};
    public static processes = [];
    public static result = null;
    public static resultFile: string  = "";
    public static rootFolder: string  = "";

    public static hasFiles: boolean = false;
    public static hasImages: boolean  = false;
}

export = Collection;