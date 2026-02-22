import { isBlockCodeBlock, parseBruFile } from "@global_shared";
import { LanguageRequestWithTestEnvironmentInfo } from "../../shared";
import { getHoverForNonCodeBlock } from "./getHoverForNonCodeBlock";
import { getHoverForCodeBlock } from "./getHoverForCodeBlock";

export function handleHoverRequest({
    baseRequest,
    itemProvider,
    configuredEnvironmentName,
    logger,
}: LanguageRequestWithTestEnvironmentInfo) {
    const { filePath, documentHelper, position } = baseRequest;
    const collection = itemProvider.getAncestorCollectionForPath(filePath);

    if (!collection) {
        return undefined;
    }

    const { blocks: allBlocks } = parseBruFile(documentHelper);

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
