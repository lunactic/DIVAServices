/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import * as nconf from "nconf";
import * as jsonschema from "jsonschema";
import logger = require("../logging/logger");

class SchemaValidator {
    static validator = new jsonschema.Validator();

    static validate(input: Object, schema: string, callback: Function): void {
        try {
            let errors = SchemaValidator.validator.validate(input, nconf.get(schema)).errors;
            if (errors.length > 0) {
                let error = {
                    statusCode: 500,
                    errorType: "validation error",
                    statusText: errors[0].stack
                };
                callback(error);
            } else {
                callback(null);
            }
        } catch (error) {
            logger.log("error", error, "SchemaValidator");
        }
    }
}
