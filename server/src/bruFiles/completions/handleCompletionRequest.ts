import { isBlockCodeBlock, Logger, parseBruFile } from "@global_shared";
import { CompletionItem } from "vscode-languageserver";
import {
    LanguageFeatureBaseRequest,
    TypedCollectionItemProvider,
} from "../../shared";
import { getCompletionsForCodeBlock } from "./getCompletionsForCodeBlock";
import { getCompletionsForNonCodeBlock } from "./getCompletionsForNonCodeBlock";

export async function handleCompletionRequest(
    baseRequest: LanguageFeatureBaseRequest,
    itemProvider: TypedCollectionItemProvider,
    configuredEnvironment?: string,
    logger?: Logger,
): Promise<CompletionItem[] | undefined> {
    const { documentHelper, position, token, filePath } = baseRequest;
    const { blocks: allBlocks } = parseBruFile(documentHelper);

    const blockContainingPosition = allBlocks.find(({ contentRange }) =>
        contentRange.contains(position),
    );

    if (!blockContainingPosition) {
        return undefined;
    }

    const collection = itemProvider.getAncestorCollectionForPath(filePath);

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return isBlockCodeBlock(blockContainingPosition) && collection
        ? getCompletionsForCodeBlock(
              {
                  request: baseRequest,
                  file: { allBlocks, blockContainingPosition, collection },
                  logger,
              },
              configuredEnvironment,
          )
        : getCompletionsForNonCodeBlock(
              {
                  request: baseRequest,
                  file: { allBlocks, blockContainingPosition, collection },
                  logger,
              },
              itemProvider,
              configuredEnvironment,
          );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}
