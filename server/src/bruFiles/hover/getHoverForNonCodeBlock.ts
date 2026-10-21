import {
    Block,
    getDictionaryBlockArrayField,
    Logger,
    MetaBlockKey,
    RequestFileBlockName,
} from "@global_shared";
import { TypedCollectionItemProvider } from "../../shared";
import { getHoverForExistingTag } from "../../shared/getHoverForExistingTag";
import { Hover } from "vscode-languageserver";
import { getHoverForVariableInNonCodeSection } from "../../shared/variables/getHoverForVariableInNonCodeSection";
import {
    BlockRequestWithAdditionalData,
    toVariableSectionRequest,
} from "../shared/interfaces";

export function getHoverForNonCodeBlock(
    itemProvider: TypedCollectionItemProvider,
    params: BlockRequestWithAdditionalData<Block>,
    configuredEnvironmentName?: string,
) {
    return params.file.blockContainingPosition.name == RequestFileBlockName.Meta
        ? getHoverForTagsInMetaBlock(itemProvider, params)
        : getHoverForVariableInNonCodeSection(
              toVariableSectionRequest(params),
              configuredEnvironmentName,
          );
}

function getHoverForTagsInMetaBlock(
    itemProvider: TypedCollectionItemProvider,
    {
        file: { collection, blockContainingPosition },
        request,
        logger,
    }: BlockRequestWithAdditionalData<Block>,
): Hover | undefined {
    const { position, token, filePath, documentHelper } = request;

    if (blockContainingPosition.name != RequestFileBlockName.Meta) {
        return undefined;
    }

    const tagsField = getDictionaryBlockArrayField(
        blockContainingPosition,
        MetaBlockKey.Tags,
    );
    if (!tagsField || tagsField.values.length == 0) {
        return undefined;
    }

    const tagValueField = tagsField.values.find(({ range }) =>
        range.contains(position),
    );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }
    if (!tagValueField) {
        return undefined;
    }

    return getHoverForExistingTag(
        tagValueField.content,
        filePath,
        documentHelper,
        { itemProvider, collection },
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        "Cancellation requested while trying to determine hover for position in non-code block.",
    );
}
