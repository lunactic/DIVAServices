/**
 * Created by lunactic on 02.11.16.
 */
/// <reference path="../_all.d.ts" />
"use strict";

import * as express from "express";

module Route {
    export class Index {

        public index(req: express.Request, res: express.Response, next: express.NextFunction) {
            //render page
            res.json({hello: "world"});
        }
    }
}

export = Route;