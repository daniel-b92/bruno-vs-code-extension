import { Range } from "..";

export interface BrunoVariableReference {
    variableName: string;
    variableNameRange: Range;
    variableType: BrunoVariableType;
    referenceType: VariableReferenceType;
    scope?: VariableAvailabilityScope;
}

export enum BrunoVariableType {
    Unknown = "Unknown",
    Global = "Global",
    Environment = "Environment",
    Simple = "Simple",
}

export enum VariableReferenceType {
    Read = "Read",
    Write = "Write",
    Delete = "Delete",
}

export type VariableAvailabilityScope =
    (typeof VariableAvailabilityScopes)[keyof typeof VariableAvailabilityScopes];

export const VariableAvailabilityScopes = {
    Global: 1,
    Collection: 2,
    PreRequestScriptForOwnItemAndDescendants: 3,
    PostResponseScriptForOwnItemAndDescendants: 4,
} as const;

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
    DeleteEnvVar = "deleteEnvVar",
    GetVar = "getVar",
    SetVar = "setVar",
}
