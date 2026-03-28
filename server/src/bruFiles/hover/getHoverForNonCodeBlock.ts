import {
    Block,
    BrunoVariableType,
    getBlocksWithoutVariableSupport,
    getDictionaryBlockArrayField,
    getExistingRequestFileTags,
    getVariableForPositionInNonCodeBlock,
    Logger,
    MetaBlockKey,
    Range,
    RequestFileBlockName,
    TagOccurences,
    TextDocumentHelper,
    VariableReferenceType,
} from "@global_shared";
import {
    AdditionalCollectionData,
    TypedCollectionItemProvider,
} from "../../shared";
import { basename } from "path";
import { Hover } from "vscode-languageserver";
import { getHoverForBrunoVariable } from "./getHoverForBrunoVariable";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";

export function getHoverForNonCodeBlock(
    itemProvider: TypedCollectionItemProvider,
    params: BlockRequestWithAdditionalData<Block>,
    configuredEnvironmentName?: string,
) {
    return params.file.blockContainingPosition.name == RequestFileBlockName.Meta
        ? getHoverForTagsInMetaBlock(itemProvider, params)
        : getHoverForVariablesInNonCodeBlocks(
              params,
              params.request.documentHelper,
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
    fullRequest: BlockRequestWithAdditionalData<Block>,
    docHelper: TextDocumentHelper,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const {
        file: { blockContainingPosition },
        request: { position, token },
        logger,
    } = fullRequest;

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

    if (!variable) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return getHoverForBrunoVariable(
        fullRequest,
        {
            variableName: variable.name,
            variableNameRange: new Range(variable.start, variable.end),
            variableType: BrunoVariableType.Unknown,
            // In non-code blocks, variables can not be set.
            referenceType: VariableReferenceType.Read,
        },
        configuredEnvironmentName,
    );
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
