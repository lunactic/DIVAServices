
import * as express from 'express';
import { DivaError } from '../models/divaError';
import { QueueHandler } from '../processingQueue/queueHandler';
import { WorkflowManager } from '../workflows/workflowManager';
import { PostHandler } from './postHandler';

"use strict";

let router = express.Router();


router.post("/workflows", async function (req: express.Request, res: express.Response) {
    try {
        let workflowManager = new WorkflowManager(req.body);
        await workflowManager.parseWorkflow();
        await workflowManager.createServicesEntry();
        await workflowManager.createInfoFile();
        await workflowManager.updateRootFile();
        res.status(200).send();
    } catch (error) {
        sendError(res, error);
    }
});

router.post("/workflows/*", async function (req: express.Request, res: express.Response) {
    try {
        let response = await PostHandler.handleRequest(req);
        response["statusCode"] = 202;
        send200(res, response);
        QueueHandler.executeDockerRequest();
    } catch (error) {
        sendError(res, error);
    }
});

function send200(res: express.Response, response: any) {
    res.status(200);
    try {
        let resp = JSON.parse(response);
        res.json(resp);
    } catch (error) {
        res.json(response);
    }
}

function sendError(res: express.Response, error: DivaError) {
    res.status(error.statusCode || 500);
    res.json({ message: error.message, errorType: error.errorType });
}

export = router;