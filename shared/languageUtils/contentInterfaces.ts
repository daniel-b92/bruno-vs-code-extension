import { Range } from "..";

export interface BrunoVariableReference {
    variableName: string;
    variableNameRange: Range;
    variableType: BrunoVariableType;
    referenceType: VariableReferenceType;
}

export enum BrunoVariableType {
    Unknown = 1,
    Global = 2,
    Environment = 3,
    Runtime = 4,
}

export enum VariableReferenceType {
    Read = "Read",
    Write = "Write",
}

export interface InbuiltFunctionIdentifier {
    baseIdentifier: InbuiltFunctionBaseIdentifierEnum;
    functionName: InbuiltFunctionName;
}

export enum InbuiltFunctionBaseIdentifierEnum {
    Bru = "bru",
    Req = "req",
    Res = "res",
}

export enum InbuiltFunctionName {
    GetGlobalEnvVar = "getGlobalEnvVar",
    SetGlobalEnvVar = "setGlobalEnvVar",
    GetEnvVar = "getEnvVar",
    SetEnvVar = "setEnvVar",
    GetVar = "getVar",
    SetVar = "setVar",
}
