import { Block, Logger, CodeBlock } from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../../shared";

export interface CodeBlockRequestWithAdditionalData {
    request: LanguageFeatureBaseRequest;
    file: {
        collection: TypedCollection;
        allBlocks: Block[];
        blockContainingPosition: CodeBlock;
    };
    logger?: Logger;
}

export interface NonCodeBlockRequestWithAdditionalData {
    request: LanguageFeatureBaseRequest;
    file: {
        allBlocks: Block[];
        blockContainingPosition: Block;
        collection: TypedCollection;
    };
    logger?: Logger;
}
