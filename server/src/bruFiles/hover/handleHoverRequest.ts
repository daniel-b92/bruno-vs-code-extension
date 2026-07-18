import { isBlockCodeBlock, parseBruFile } from "@global_shared";
import { LanguageRequestWithTestEnvironmentInfo } from "../../shared";
import { getHoverForNonCodeBlock } from "./getHoverForNonCodeBlock";
import { getHoverForCodeBlock } from "./getHoverForCodeBlock";

export function handleHoverRequest({
    baseRequest,
    itemProvider,
    collection,
    configuredEnvironmentName,
    logger,
}: LanguageRequestWithTestEnvironmentInfo) {
    const { documentHelper, filePath, position } = baseRequest;
    const itemType = collection
        .getStoredDataForPath(filePath)
        ?.item.getItemType();

    if (!itemType) {
        return undefined;
    }

    const { blocks: allBlocks } = parseBruFile(documentHelper, itemType);

    const blockContainingPosition = allBlocks.find(({ contentRange }) =>
        contentRange.contains(position),
    );

    if (!blockContainingPosition) {
        return undefined;
    }

    if (isBlockCodeBlock(blockContainingPosition)) {
        return getHoverForCodeBlock(
            {
                file: { collection, allBlocks, blockContainingPosition },
                request: baseRequest,
                logger,
            },
            configuredEnvironmentName,
        );
    }

    return getHoverForNonCodeBlock(
        itemProvider,
        {
            request: baseRequest,
            file: { allBlocks, blockContainingPosition, collection },
            logger,
        },
        configuredEnvironmentName,
    );
}
