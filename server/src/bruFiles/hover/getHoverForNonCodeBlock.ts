import {
    getBlocksWithoutVariableSupport,
    getDictionaryBlockArrayField,
    getExistingRequestFileTags,
    getVariableForPositionInNonCodeBlock,
    Logger,
    MetaBlockKey,
    RequestFileBlockName,
    TagOccurences,
    TextDocumentHelper,
    VariableReferenceType,
} from "@global_shared";
import {
    AdditionalCollectionData,
    getHoverForEnvVariable,
    TypedCollectionItemProvider,
} from "../../shared";
import { NonCodeBlockRequestWithAdditionalData } from "../shared/interfaces";
import { basename } from "path";
import { Hover } from "vscode-languageserver";

export function getHoverForNonCodeBlock(
    itemProvider: TypedCollectionItemProvider,
    params: NonCodeBlockRequestWithAdditionalData,
    configuredEnvironmentName?: string,
) {
    return (
        getHoverForTagsInMetaBlock(itemProvider, params) ??
        getHoverForVariablesInNonCodeBlocks(
            params,
            params.request.documentHelper,
            configuredEnvironmentName,
        )
    );
}

function getHoverForTagsInMetaBlock(
    itemProvider: TypedCollectionItemProvider,
    {
        file: { collection, blockContainingPosition },
        request,
        logger,
    }: NonCodeBlockRequestWithAdditionalData,
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

    const tagOccurences = getExistingRequestFileTags(itemProvider, {
        collection,
        pathToIgnore: filePath,
    }).filter(({ tag }) => tag == tagValueField.content);

    if (tagOccurences.length < 1) {
        return { contents: "No other usages found." };
    }

    return getHoverForTagOccurences(filePath, documentHelper, tagOccurences[0]);
}

function getHoverForVariablesInNonCodeBlocks(
    {
        file: { allBlocks, collection, blockContainingPosition },
        request,
        logger,
    }: NonCodeBlockRequestWithAdditionalData,
    docHelper: TextDocumentHelper,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const { position, token } = request;

    if (
        (getBlocksWithoutVariableSupport() as string[]).includes(
            blockContainingPosition.name,
        )
    ) {
        return undefined;
    }

    const variable = getVariableForPositionInNonCodeBlock({
        documentHelper: docHelper,
        position,
    });

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return variable
        ? getHoverForEnvVariable(
              {
                  requestData: {
                      collection,
                      variable,
                      functionType: VariableReferenceType.Read, // In non-code blocks, variables can not be set.
                      requestPosition: position,
                      token,
                  },
                  bruFileSpecificData: { allBlocks, blockContainingPosition },
                  logger,
              },
              configuredEnvironmentName,
          )
        : undefined;
}

function getHoverForTagOccurences(
    filePath: string,
    docHelper: TextDocumentHelper,
    {
        pathsInOwnCollection,
        inOtherCollections,
    }: TagOccurences<AdditionalCollectionData>,
): Hover | undefined {
    const lineBreak = docHelper.getMostUsedLineBreak();
    const tableHeader = `| collection | usages |
| :--------------- | ----------------: | ${lineBreak}`;

    if (pathsInOwnCollection.length == 0 && inOtherCollections.length == 0) {
        return { contents: "No other usages found." };
    }

    const content = tableHeader
        .concat(
            pathsInOwnCollection.length > 0
                ? `| own | ${pathsInOwnCollection.filter((path) => path != filePath).length} other file(s) | ${lineBreak}`
                : "",
        )
        .concat(
            inOtherCollections.length > 0
                ? inOtherCollections
                      .map(
                          ({ collection, paths }) =>
                              `| ${basename(collection.getRootDirectory())} | ${paths.length} |`,
                      )
                      .join(lineBreak)
                : "",
        );

    return { contents: { kind: "markdown", value: content } };
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        "Cancellation requested while trying to determine hover for position in non-code block.",
    );
}
