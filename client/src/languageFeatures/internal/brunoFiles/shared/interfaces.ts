import { JsCodeBlock } from "@global_shared";
import { OutputChannelLogger, TypedCollection } from "@shared";
import { LanguageFeatureRequest } from "../../shared/interfaces";

export interface CodeBlockLanguageFeatureRequestWithAdditionalData {
    request: LanguageFeatureRequest;
    file: {
        collection: TypedCollection;
        blockContainingPosition: JsCodeBlock;
    };
    logger?: OutputChannelLogger;
}
