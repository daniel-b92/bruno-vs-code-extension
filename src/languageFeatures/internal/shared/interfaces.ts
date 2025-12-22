import {
    TextDocument,
    Position as VsCodePosition,
    CancellationToken,
} from "vscode";

export interface LanguageFeatureRequest {
    document: TextDocument;
    position: VsCodePosition;
    token: CancellationToken;
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

export enum EnvVariableFunctionType {
    Read = 1,
    ModifyOrDelete = 2,
}
