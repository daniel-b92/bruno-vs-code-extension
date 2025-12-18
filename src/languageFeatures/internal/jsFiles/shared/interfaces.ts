import { Collection, OutputChannelLogger } from "../../../../shared";
import { Node } from "typescript";
import { LanguageFeatureRequest } from "../../shared/interfaces";

export interface JsLanguageFeatureRequestWithAdditionalData {
    request: LanguageFeatureRequest;
    file: {
        collection: Collection;
        fileContent: FileContentWithTsNode;
    };
    logger?: OutputChannelLogger;
}

export interface FileContentWithTsNode {
    content: string;
    asTsNode: Node;
}
