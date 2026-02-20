import { isBlockCodeBlock, parseBruFile, Logger } from "@global_shared";
import {
    LanguageFeatureBaseRequest,
    TypedCollectionItemProvider,
} from "../../shared";
import { getHoverForNonCodeBlock } from "./getHoverForNonCodeBlock";
import { getHoverForCodeBlock } from "./getHoverForCodeBlock";

export function handleHoverRequest(
    baseRequest: LanguageFeatureBaseRequest,
    itemProvider: TypedCollectionItemProvider,
    configuredEnvironmentName?: string,
    logger?: Logger,
) {
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
