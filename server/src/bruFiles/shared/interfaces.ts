import { Block, getVariableScopeSectionsFromBlocks } from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../../shared";
import { VariableSectionRequest } from "../../shared/variables/interfaces";
import { Logger } from "@global_shared";

export interface BlockRequestWithAdditionalData<T extends Block> {
    request: LanguageFeatureBaseRequest;
    file: {
        collection: TypedCollection;
        allBlocks: Block[];
        blockContainingPosition: T;
    };
    logger?: Logger;
}

/** Maps the Bru-specific request to the format-independent representation that is used for variables. */
export function toVariableSectionRequest({
    request,
    file: { collection, allBlocks, blockContainingPosition },
    logger,
}: BlockRequestWithAdditionalData<Block>): VariableSectionRequest {
    return {
        request,
        file: {
            collection,
            allSections: getVariableScopeSectionsFromBlocks(allBlocks),
            sectionContainingPosition: getVariableScopeSectionsFromBlocks([
                blockContainingPosition,
            ])[0],
        },
        logger,
    };
}

export type MissingBlock =
    | {
          mandatory: boolean;
          name: string;
      }
    | {
          mandatory: boolean;
          mutuallyExclusiveBlocks: string[];
      };
