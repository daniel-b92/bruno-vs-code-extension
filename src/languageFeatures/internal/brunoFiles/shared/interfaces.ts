import {
    CancellationToken,
    TextDocument,
    Position as VsCodePosition,
} from "vscode";

export interface LanguageFeatureRequest {
    document: TextDocument;
    position: VsCodePosition;
    token: CancellationToken;
}
