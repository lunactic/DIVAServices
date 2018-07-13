"use strict";
import * as express from "express";
import * as passport from "passport";
import { FileHelper } from "../helper/fileHelper";
import { Account } from "../models/account";

let router = express.Router();

/**
 * Crate a new account for managing things
 */
router.post("/mgmt/register", function (req: express.Request, res: express.Response) {
    Account.register(new Account({
        username: req.body["username"],
        type: "user"
    }), req.body["password"], (err: any) => {
        if (err) {
            res.status(500).send();
        } else {
            res.status(200).send({ title: "Signup Success" });
        }
    });
});

//auth routes
router.get("/mgmt/clearData", function (req: express.Request, res: express.Response, next: express.NextFunction) {
    passport.authenticate('local', function (err: any, user: any) {
        if (err) {
            res.status(401).send();
            return;
        }
        if (!user) {
            res.status(403).send();
            return;
        }
        req.logIn(user, () => {
            let collections = FileHelper.getAllCollections();
            collections.forEach(collection => {
                FileHelper.deleteCollection(collection.toString());
            });
            res.status(200).send();
        });
    })(req, res, next);
});

export = router;