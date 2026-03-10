import { Block, Logger } from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../../shared";

export interface BlockRequestWithAdditionalData<T extends Block> {
    request: LanguageFeatureBaseRequest;
    file: {
        collection: TypedCollection;
        allBlocks: Block[];
        blockContainingPosition: T;
    };
    logger?: Logger;
}
