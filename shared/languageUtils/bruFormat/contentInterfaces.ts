import { Range } from "../..";

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
    Runtime = "Runtime",
    Folder = "Folder",
    Request = "Request",
}

export enum VariableReferenceType {
    Read = "Read",
    Write = "Write",
    Delete = "Delete",
}

export type VariableAvailabilityScope =
    (typeof VariableAvailabilityScopes)[keyof typeof VariableAvailabilityScopes];

export const VariableAvailabilityScopes = {
    Global: "Global",
    Collection: "Collection",
    PreRequestScriptForOwnItemAndDescendants:
        "PreRequestScriptForOwnItemAndDescendants",
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
    HasGlobalEnvVar = "hasGlobalEnvVar",
    SetGlobalEnvVar = "setGlobalEnvVar",
    DeleteGlobalEnvVar = "deleteGlobalEnvVar",
    GetEnvVar = "getEnvVar",
    HasEnvVar = "hasEnvVar",
    SetEnvVar = "setEnvVar",
    DeleteEnvVar = "deleteEnvVar",
    GetVar = "getVar",
    HasVar = "hasVar",
    SetVar = "setVar",
    DeleteVar = "deleteVar",
    GetRequestVar = "getRequestVar",
    GetFolderVar = "getFolderVar",
}
