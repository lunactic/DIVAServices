import Process = require("./process");
declare class ProcessingQueue {
    static queue: Process[];
    /**
     * Add a process to the processing queue
     * @param the process
     */
    addElement(element: Process): void;
    /**
     * Returns the next process
     * @returns {undefined|Process}
     */
    getNext(): Process;
    /**
     * Returns the size
     * @returns {number}
     */
    getSize(): Number;
}
export = ProcessingQueue;
