import { Range } from "..";

export interface BrunoVariableReference {
    variableName: string;
    variableNameRange: Range;
    variableType: BrunoVariableType;
    referenceType: VariableReferenceType;
}

export enum BrunoVariableType {
    Unknown = 1,
    Environment = 2,
    Runtime = 3,
}

export enum VariableReferenceType {
    Read = 1,
    ModifyOrDelete = 2,
}

export interface InbuiltFunctionIdentifier {
    baseIdentifier: InbuiltFunctionBaseIdentifierEnum;
    functionName: InbuiltEnvVariableFunctionName;
}

export enum InbuiltFunctionBaseIdentifierEnum {
    Bru = "bru",
    Req = "req",
    Res = "res",
}

export enum InbuiltEnvVariableFunctionName {
    GetEnvVar = "getEnvVar",
    SetEnvVar = "setEnvVar",
}
