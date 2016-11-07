/**
 * Created by lunactic on 02.11.16.
 */

"use strict";
import {Process}  from "./process";


export class ProcessingQueue {

    static queue: Process[] = [];

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