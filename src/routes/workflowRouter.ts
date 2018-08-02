
import * as express from 'express';
import { DivaError } from '../models/divaError';
import { WorkflowManager } from '../workflows/workflowManager';

"use strict";

let router = express.Router();

router.post("/workflows", async function (req: express.Request, res: express.Response) {
    try {
        let workflowManager = new WorkflowManager(req.body);
        await workflowManager.parseWorkflow();
        res.status(200).send();
    } catch (error) {
        sendError(res, error);
    }
});

function sendError(res: express.Response, error: DivaError) {
    res.status(error.statusCode || 500);
    res.json({ message: error.message, errorType: error.errorType });
}

export = router;