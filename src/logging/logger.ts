/**
 * Created by lunactic on 02.11.16.
 */

"use strict";

import * as log4js from "log4js";
import * as nconf from "nconf";

log4js.configure({appenders: nconf.get("loggers:appenders")});
let logger = log4js.getLogger("server");
logger.setLevel(nconf.get("logger:lever"));


class Logger {

    static log(level: string, msg: string, module: string) {
        level = level || "info";

        if (module != null) {
            logger[level](msg + (" [ " + module + "]"));
        } else {
            logger[level](msg);
        }
    }
}


export = Logger;