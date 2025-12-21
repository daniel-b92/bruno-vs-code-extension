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
    functionName: string;
}

export enum InbuiltFunctionBaseIdentifierEnum {
    Bru = "bru",
    Req = "req",
    Res = "res",
}
