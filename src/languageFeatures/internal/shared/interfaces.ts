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
