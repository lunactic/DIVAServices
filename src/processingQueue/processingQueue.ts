/**
 * Created by lunactic on 02.11.16.
 */

"use strict";
import {Process}  from "./process";

/**
 * class representing a processing queue
 * 
 * @export
 * @class ProcessingQueue
 */
export class ProcessingQueue {

    /**
     * the queue array
     * 
     * @static
     * @type {Process[]}
     * @memberOf ProcessingQueue
     */
    static queue: Process[] = [];

    getQueue(): any{
        return ProcessingQueue.queue;
    }

    /**
     * Add a process to the processing queue
     * @param the process
     */
    addElement(element: Process): void {
        ProcessingQueue.queue.push(element);
    }

    /**
     * Returns the next process
     * @returns {undefined|Process}
     */
    getNext(): Process {
        return ProcessingQueue.queue.shift();
    }

    /**
     * Returns the size
     * @returns {number}
     */
    getSize(): Number {
        return ProcessingQueue.queue.length;
    }

}