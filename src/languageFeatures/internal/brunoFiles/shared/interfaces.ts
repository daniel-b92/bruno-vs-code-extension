import {
    CancellationToken,
    TextDocument,
    Position as VsCodePosition,
} from "vscode";
import { Collection, OutputChannelLogger, Range } from "../../../../shared";
import { Node } from "typescript";

export interface LanguageFeatureRequestWithAdditionalData {
    request: LanguageFeatureRequest;
    file: {
        collection: Collection;
        blockContainingPosition: CodeBlockWithTsNode;
    };
    logger?: OutputChannelLogger;
}

export interface LanguageFeatureRequest {
    document: TextDocument;
    position: VsCodePosition;
    token: CancellationToken;
}

export interface CodeBlockWithTsNode {
    content: string;
    contentRange: Range;
    blockAsTsNode: Node;
}
