import { CodeBlock } from "@global_shared";
import { Collection, OutputChannelLogger } from "@shared";
import { LanguageFeatureRequest } from "../../shared/interfaces";

export interface CodeBlockLanguageFeatureRequestWithAdditionalData {
    request: LanguageFeatureRequest;
    file: {
        collection: Collection;
        blockContainingPosition: CodeBlock;
    };
    logger?: OutputChannelLogger;
}
