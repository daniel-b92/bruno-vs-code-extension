import {
    BrunoFileType,
    isBlockCodeBlock,
    Logger,
    parseBruFile,
} from "@global_shared";
import { CompletionItem } from "vscode-languageserver";
import { LanguageRequestWithTestEnvironmentInfo } from "../../shared";
import { getCompletionsForCodeBlock } from "./getCompletionsForCodeBlock";
import { getCompletionsForNonCodeBlock } from "./getCompletionsForNonCodeBlock";
import { getCompletionsForPositionOutsideOfBlocks } from "./getCompletionsForPositionOutsideOfBlocks";

export async function handleCompletionRequest({
    baseRequest,
    collection,
    itemProvider,
    configuredEnvironmentName,
    logger,
}: LanguageRequestWithTestEnvironmentInfo): Promise<
    CompletionItem[] | undefined
> {
    const { documentHelper, position, token, filePath } = baseRequest;
    const { blocks: allBlocks } = parseBruFile(documentHelper);

    const blockContainingPosition = allBlocks.find(({ contentRange }) =>
        contentRange.contains(position),
    );

    if (!blockContainingPosition) {
        const itemType = collection
            .getStoredDataForPath(filePath)
            ?.item.getItemType();
        return itemType
            ? getCompletionsForPositionOutsideOfBlocks(
                  baseRequest,
                  itemType as BrunoFileType,
                  allBlocks,
                  collection,
              )
            : undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return isBlockCodeBlock(blockContainingPosition)
        ? getCompletionsForCodeBlock(
              {
                  request: baseRequest,
                  file: { allBlocks, blockContainingPosition, collection },
                  logger,
              },
              configuredEnvironmentName,
          )
        : getCompletionsForNonCodeBlock(
              {
                  request: baseRequest,
                  file: { allBlocks, blockContainingPosition, collection },
                  logger,
              },
              itemProvider,
              configuredEnvironmentName,
          );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}
