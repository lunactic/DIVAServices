import { WorkflowInput } from "../workflowInput";
import { WorkflowOutput } from "../workflowOutput";
import { WorkflowWarning } from "../workflowWarning";

export interface ITypeChecker {
    checkType(input: WorkflowInput, output: WorkflowOutput, warnings: WorkflowWarning[]): Promise<void>;
}