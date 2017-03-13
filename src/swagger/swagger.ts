"use strict";
/**
 * Created by lunactic on 07.11.16.
 */

import * as _ from "lodash";
import * as fs from "fs";
import {IoHelper} from "../helper/ioHelper";
import * as nconf from "nconf";
import * as request from "request";
import * as util from "util";

/**
 * class for handling swagger/openAPI things
 * 
 * @export
 * @class Swagger
 */
export class Swagger {

    /**
     * create an entry for a method to the swagger file
     * 
     * @static
     * @param {*} algorithmInfos the algorithm infos
     * @param {string} route the method route
     * 
     * @memberOf Swagger
     */
    static createEntry(algorithmInfos: any, route: string): void {
        let currentSwagger = IoHelper.openFile(nconf.get("paths:swaggerFile"));

        let inputs = _.filter(algorithmInfos.input, function (input: any) {
            return input[_.keys(input)[0]].userdefined;
        });

        let names = [];
        let inputProps = {};
        inputProps["highlighter"] = {
            type: "object"
        };

        _.forEach(inputs, function (input: any) {
            switch (_.keys(input)[0]) {
                case "select":
                    inputProps[input[_.keys(input)[0]].name] = {
                        type: "string",
                        enum: input.select.options.values,
                        default: input.select.options.values[input.select.options.default]
                    };
                    break;
                case "text":
                    inputProps[input[_.keys(input)[0]].name] = {
                        type: "string",
                        default: input.text.options.default
                    };
                    if (input.text.options.min != null) {
                        inputProps[input[_.keys(input)[0]].name]["minLength"] = input.text.options.min;
                    }
                    if (input.text.options.max != null) {
                        inputProps[input[_.keys(input)[0]].name]["maxLength"] = input.text.options.max;
                    }
                    break;
                case "number":
                    inputProps[input[_.keys(input)[0]].name] = {
                        type: "number",
                        default: input.number.options.default
                    };
                    if (input.number.options.min != null) {
                        inputProps[input[_.keys(input)[0]].name]["min"] = input.number.options.min;
                    }
                    if (input.number.options.max != null) {
                        inputProps[input[_.keys(input)[0]].name]["max"] = input.number.options.max;
                    }
                    break;
            }
            names.push(input[_.keys(input)[0]].name);
        });
        let jsonInputs = {
            type: "object",
            required: true,
            properties: inputProps
        };

        let definitions = {
            type: "object",
            required: ["inputs", "images"],
            properties: {
                inputs: jsonInputs,
                images: {
                    $ref: "#/definitions/inputImages"
                }
            }
        };

        let entry = {
            get: {
                description: "get method information",
                produces: ["application/json"],
                tags: ["methods"],
                parameters: [],
                responses: {
                    200: {
                        description: "method information",
                        schema: {
                            $ref: "http://$BASEURL$/schemas/details"
                        }
                    }
                }
            },
            post: {
                description: "execute method",
                produces: ["application/json"],
                tags: ["methods"],
                parameters: [
                    {
                        name: "execution parameters",
                        in: "body",
                        description: "needed execution parameters",
                        required: true,
                        schema: {
                            $ref: "#/definitions" + algorithmInfos.general.name.replace(/\s/g, "").toLowerCase()
                        }
                    }
                ],
                responses: {
                    202: {
                        description: "start execution response",
                        schema: {
                            $ref: "#/definitions/startExecution"
                        }
                    }
                }
            }
        };
        currentSwagger.paths["/" + route] = entry;
        currentSwagger.definitions[algorithmInfos.general.name.replace(/\s/g, "").toLowerCase()] = definitions;
        IoHelper.saveFile(nconf.get("paths:swaggerFile"), currentSwagger, "utf8");
    }

    //TODO: Some things missing

}