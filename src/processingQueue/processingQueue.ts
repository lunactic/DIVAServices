/**
 * Created by Marcel Würsch on 02.11.16.
 */

"use strict";
import { Process } from "./process";

/**
 * class representing a processing queue
 * 
 * @export
 * @class ProcessingQueue
 */
export class ProcessingQueue {
    /**
     * The array for the processing queue
     * 
     * @static
     * @type {Process[]}
     * @memberof ProcessingQueue
     */
    static queue: Process[] = [];

    /**
     * Add a process to the processing queue 
     * 
     * @param {Process} element the process to add to the queue
     * @memberof ProcessingQueue
     */
    addElement(element: Process): void {
        ProcessingQueue.queue.push(element);
    }

    /**  
     * Returns the next process
     *
     * @returns {Process} the next process in the queue 
     * @memberof ProcessingQueue
     */
    getNext(): Process {
        return ProcessingQueue.queue.shift();
    }

    /**
     * 
     * 
     * @returns {Number} The size of the processing queue
     * @memberof ProcessingQueue
     */
    getSize(): Number {
        return ProcessingQueue.queue.length;
    }

}