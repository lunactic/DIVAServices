/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import * as nconf from "nconf";
import * as jsonschema from "jsonschema";
import { Logger } from "../logging/logger";

export class SchemaValidator {
    static validator = new jsonschema.Validator();

    static validate(input: Object, schema: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            try {
                let errors = SchemaValidator.validator.validate(input, nconf.get(schema)).errors;
                if (errors.length > 0) {
                    let error = {
                        statusCode: 500,
                        errorType: "validation error",
                        statusText: errors[0].message
                    };
                    reject(error);
                } else {
                    resolve();
                }
            } catch (error) {
                Logger.log("error", error, "SchemaValidator");
            }
        });

    }
}
