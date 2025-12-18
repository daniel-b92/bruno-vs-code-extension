import { Collection, OutputChannelLogger, Range } from "../../../../shared";
import { Node } from "typescript";
import { LanguageFeatureRequest } from "../../shared/interfaces";

export interface BruLanguageFeatureRequestWithAdditionalData {
    request: LanguageFeatureRequest;
    file: {
        collection: Collection;
        blockContainingPosition: CodeBlockWithTsNode;
    };
    logger?: OutputChannelLogger;
}

export interface CodeBlockWithTsNode {
    content: string;
    contentRange: Range;
    blockAsTsNode: Node;
}
