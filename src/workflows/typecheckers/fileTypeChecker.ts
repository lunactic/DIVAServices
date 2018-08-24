import { isNullOrUndefined } from "util";
import { DivaError } from "../../models/divaError";
import { WorkflowInput } from "../workflowInput";
import { WorkflowOutput } from "../workflowOutput";
import { WorkflowWarning } from "../workflowWarning";
import { ITypeChecker } from "./iTypeChecker";

/**
 * This class provides functionality for checking if a File output can be forwarded to a File input in a workflow
 *
 * @export
 * @class FileTypeChecker
 * @implements {ITypeChecker}
 */
export class FileTypeChecker implements ITypeChecker {

    /**
     * Check if a file output from a workflow step can be matched to a file input from a workflow step
     *
     * @param {WorkflowInput} input The input that takes the file from output
     * @param {WorkflowOutput} output The output that creates the file that should be used
     * @param {WorkflowWarning[]} warnings A list of warnings that can be appended with new warnings
     * @returns {Promise<void>} resolves once all checks are completed, or rejects if an error does not allow the workflow to be created
     * @memberof FileTypeChecker
     */
    checkType(input: WorkflowInput, output: WorkflowOutput, warnings: WorkflowWarning[]): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                //check mime-type matching    
                if (!isNullOrUndefined(input.infoSpecification.file.options.mimeTypes) && !isNullOrUndefined(input.infoSpecification.file.options.mimeTypes.allowed) &&
                    !isNullOrUndefined(output.infoSpecification.file.options.mimeTypes) && !isNullOrUndefined(output.infoSpecification.file.options.mimeTypes.allowed)) {
                    let union = [...new Set(input.infoSpecification.file.options.mimeTypes.allowed.concat(output.infoSpecification.file.options.mimeTypes.allowed))];
                    if (union.length === 0) {
                        reject(new DivaError("Incompatible mimeTypes between Output: " + output.name + " and Input: " + input.name, 500, "WorkflowCreationError"));
                        return;
                    }
                }
                //check image properties
                if ((input.infoSpecification.file.type !== undefined || input.infoSpecification.file.type !== null) &&
                    (output.infoSpecification.file.type !== undefined || output.infoSpecification.file.type !== null)) {
                    if (input.infoSpecification.file.type === 'image' && output.infoSpecification.file.type === 'image') {
                        await this.checkImageProperties(input, output);
                    }
                }
                resolve();
            } catch (error) {
                reject(error);
                return;
            }
        });
    }

    /**
     * Check image properties provided an input and an output
     *
     * @param {WorkflowInput} input The WorkflowInput containing the input image information
     * @param {WorkflowOutput} output The WorkflowOutput containing the output image information 
     * @returns {Promise<void>} resolves once all checks are ok, or rejects if there is an error that does not allow the workflow to be created
     * @memberof FileTypeChecker
     */
    checkImageProperties(input: WorkflowInput, output: WorkflowOutput): Promise<void> {
        return new Promise((resolve, reject) => {
            if ((input.infoSpecification.file.options.colorspace !== undefined || input.infoSpecification.file.options.colorspace !== null) &&
                (output.infoSpecification.file.options.colorspace !== undefined || output.infoSpecification.file.options.colorspace !== null)) {
                if (input.infoSpecification.file.options.colorspace === 'binary' && output.infoSpecification.file.options.colorspace !== 'binary') {
                    reject(new DivaError("Trying to feed a non binary output image from output: " + output.name + " to input: " + input.name + " which requires a binary image", 500, "WorkflowCreationError"));
                    return;
                }
            }
            resolve();
        });
    }

}