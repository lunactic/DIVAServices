/**
 * Created by lunactic on 02.11.16.
 */
"use strict";

import * as async from "async";

import logger = require("../logging/logger");
import md5 = require("md5");
import * as nconf from "nconf";
import * as path from "path";
import * as express from "express";

let router = express.Router();


export = router;