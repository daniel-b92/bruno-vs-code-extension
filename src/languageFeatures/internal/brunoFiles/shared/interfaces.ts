import { Node } from "typescript";
import {
    Block,
    Collection,
    OutputChannelLogger,
    Range,
} from "../../../../shared";
import { LanguageFeatureRequest } from "../../shared/interfaces";

export interface BruLanguageFeatureRequestWithAdditionalData {
    request: LanguageFeatureRequest;
    file: {
        collection: Collection;
        blockContainingPosition: Block;
    };
    logger?: OutputChannelLogger;
}

export interface CodeBlockWithTsNode {
    content: string;
    contentRange: Range;
    blockAsTsNode: Node;
}
