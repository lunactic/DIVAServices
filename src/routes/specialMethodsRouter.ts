"use strict";
/**
 * Created by Marcel Würsch on 08.11.16.
 */
import { Logger } from "../logging/logger";
import * as nconf from "nconf";
import * as express from "express";
import { DivaError } from '../models/divaError';
import { IoHelper } from '../helper/ioHelper';
import * as passport from "passport";
import { Account } from "../models/account";
import { FileHelper } from "../helper/fileHelper";

let router = express.Router();

/**
 * Crate a new account for managing things
 */
router.post("/mgmt/register", function (req: express.Request, res: express.Response) {
    Account.register(new Account({
        username: req.body["username"],
        type: "user"
    }), req.body["password"], (err: any, account: any) => {
        if (err) {
            res.status(500).send();
        } else {
            res.status(200).send({ title: "Signup Success" });
        }
    });
});

//auth routes
router.get("/mgmt/clearData", function (req: express.Request, res: express.Response, next: express.NextFunction) {
    passport.authenticate('local', function (err: any, user: any, info: any) {
        if (err) {
            res.status(500).send();
        }
        if (!user) {
            res.status(500).send();
        }
        req.logIn(user, (err: any) => {
            let collections = FileHelper.getAllCollections();
            collections.forEach(collection => {
                FileHelper.deleteCollection(collection.toString());
            });
            res.status(200).send();
        });
    })(req, res, next);
});

export = router;