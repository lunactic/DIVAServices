/// <reference path="_all.d.ts" />
"use strict";

if (!(process.env.NODE_ENV != null) || process.env.NODE_ENV in ["dev", "test", "prod"]) {
    console.log("please set NODE_ENV to [dev, test, prod]. going to exit");
    process.exit(0);
}

import * as nconf from "nconf";

nconf.add("server", {type: "file", file: "./conf/server." + process.env.NODE_ENV + ".json"});
nconf.add("baseImages", {type: "file", file: "./conf/baseImages.json"});
nconf.add("detailsAlgorithmSchema", {type: "file", file: "./conf/schemas/detailsAlgorithmSchema.json"});
nconf.add("generalAlgorithmSchema", {type: "file", file: "./conf/schemas/generalAlgorithmSchema.json"});
nconf.add("hostSchema", {type: "file", file: "./conf/schemas/hostSchema.json"});
nconf.add("responseSchema", {type: "file", file: "./conf/schemas/responseSchema.json"});
nconf.add("createSchema", {type: "file", file: "./conf/schemas/createAlgorithmSchema.json"});

import * as bodyParser from "body-parser";
import * as express from "express";
import * as path from "path";
import * as indexRoute from "./routes/index";
/**
 * The server.
 *
 * @class Server
 */
class Server {

    public app: express.Application;

    /**
     * Bootstrap the application.
     *
     * @class Server
     * @method bootstrap
     * @static
     * @return {ng.auto.IInjectorService} Returns the newly created injector for this app.
     */
    public static bootstrap(): Server {
        return new Server();
    }


    /**
     * Constructor.
     *
     * @class Server
     * @constructor
     */
    constructor() {
        //create expressjs application
        this.app = express();

        //configure application
        this.config();

        //configure routes
        this.routes();
    }

    /**
     * Configure application
     *
     * @class Server
     * @method config
     * @return void
     */
    private config() {
        //mount logger
        //this.app.use(logger("dev"));

        //mount json form parser
        this.app.use(bodyParser.json());

        //mount query string parser
        this.app.use(bodyParser.urlencoded({extended: true}));

        //add static paths
        this.app.use(express.static(path.join(__dirname, "public")));

        // catch 404 and forward to error handler
        this.app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
            var error = new Error("Not Found");
            err.status = 404;
            next(err);
        });
    }

    private routes() {
        //get router
        let router: express.Router;
        router = express.Router();

        //create routes
        let index: indexRoute.Index = new indexRoute.Index();

        //home page
        router.get("/", index.index.bind(index.index));

        //use router middleware
        this.app.use(router);
    }
}

var server = Server.bootstrap();
export = server.app;