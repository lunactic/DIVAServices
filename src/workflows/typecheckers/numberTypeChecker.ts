import { WorkflowInput } from "../workflowInput";
import { WorkflowOutput } from "../workflowOutput";
import { Severity, WarningType, WorkflowWarning } from "../workflowWarning";
import { ITypeChecker } from "./iTypeChecker";

export class NumberTypeChecker implements ITypeChecker {
    checkType(input: WorkflowInput, output: WorkflowOutput, warnings: WorkflowWarning[]): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            //check min value
            if ((input.infoSpecification.number.options.min !== undefined || input.infoSpecification.number.options.min !== null) &&
                (output.infoSpecification.number.options.min !== undefined || output.infoSpecification.number.options.min !== null)) {
                if (output.infoSpecification.number.options.min < input.infoSpecification.number.options.min) {
                    warnings.push(new WorkflowWarning("Output: " + output.name + " produces numbers that can be too small for Input: " + input.name + " to processs", WarningType.NumberWarning, Severity.Medium));
                }
            }

            //check max value
            if ((input.infoSpecification.number.options.max !== undefined || input.infoSpecification.number.options.max !== null) &&
                (output.infoSpecification.number.options.max !== undefined || output.infoSpecification.number.options.max !== null)) {
                if (output.infoSpecification.number.options.min > input.infoSpecification.number.options.min) {
                    warnings.push(new WorkflowWarning("Output: " + output.name + " produces numbers that can be too large for Input: " + input.name + " to processs", WarningType.NumberWarning, Severity.Medium));
                }
            }
            resolve();
        });
    }


}