import { Block, BrunoFileType, Range } from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../shared";
import { CompletionItem } from "vscode-languageserver";
import { MissingBlock } from "../shared/interfaces";
import { getMissingMandatoryBlocks } from "../shared/getMissingMandatoryBlocks";
import { getMissingOptionalBlocks } from "../shared/getMissingOptionalBlocks";

export function getCompletionsForPositionOutsideOfBlocks(
    request: LanguageFeatureBaseRequest,
    fileType: BrunoFileType,
    allBlocks: Block[],
): CompletionItem[] | undefined {
    const {
        missingBlocks: missingMandatoryBlocks,
        blocksThatCannotBeOptional,
    } = getMissingMandatoryBlocks(fileType, allBlocks);
    const missingOptionalBlocks = getMissingOptionalBlocks(
        fileType,
        allBlocks,
        blocksThatCannotBeOptional,
    );

    if (
        missingMandatoryBlocks.length == 0 &&
        missingOptionalBlocks.length == 0
    ) {
        return undefined;
    }

    return missingMandatoryBlocks
        .concat(missingOptionalBlocks)
        .flatMap((block) => mapToCompletionItems(block, request));
}

function mapToCompletionItems(
    block: MissingBlock,
    request: LanguageFeatureBaseRequest,
) {
    return "mutuallyExclusiveBlocks" in block
        ? block.mutuallyExclusiveBlocks.map((blockName) =>
              mapToCompletionItem(blockName, block.mandatory, request),
          )
        : [mapToCompletionItem(block.name, block.mandatory, request)];

    function mapToCompletionItem(
        blockName: string,
        isMandatory: boolean,
        { position }: LanguageFeatureBaseRequest,
    ): CompletionItem {
        return {
            label: blockName,
            textEdit: {
                newText: blockName,
                range: new Range(position, position),
            },
            sortText: isMandatory ? `a_${blockName}` : `b_${blockName}`,
            labelDetails: isMandatory ? undefined : { detail: ` optional` },
        };
    }
}
