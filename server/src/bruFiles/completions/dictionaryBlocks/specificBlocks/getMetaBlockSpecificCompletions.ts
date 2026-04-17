import {
    Block,
    BrunoFileType,
    getDictionaryBlockArrayField,
    getExistingRequestFileTags,
    getMetaBlockMandatoryKeys,
    getMetaBlockOptionalKeys,
    MetaBlockKey,
    Position,
    Range,
    RequestType,
} from "@global_shared";
import {
    LanguageFeatureBaseRequest,
    TypedCollection,
    TypedCollectionItemProvider,
} from "../../../../shared";
import { basename } from "path";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";
import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";
import { getSequenceValueCompletion } from "../../../shared/getSequenceValueCompletion";

export async function getMetaBlockSpecificCompletions(
    itemProvider: TypedCollectionItemProvider,
    request: LanguageFeatureBaseRequest,
    block: Block,
    itemType: BrunoFileType,
    collection?: TypedCollection,
): Promise<CompletionItem[]> {
    const mandatoryKeys = getMetaBlockMandatoryKeys(itemType);
    const optionalKeys = getMetaBlockOptionalKeys(itemType);

    if (mandatoryKeys) {
        const completionsForKeys = getCompletionsForKeys(
            request,
            block,
            {
                mandatory: mandatoryKeys,
            },
            optionalKeys ? { optional: optionalKeys } : undefined,
        );

        if (completionsForKeys) {
            return completionsForKeys;
        }
    }

    return (
        collection
            ? await getSequenceValueCompletionIfInSeqLine(
                  collection,
                  request,
                  itemType,
              )
            : []
    ).concat(
        getRequestTypeValueCompletions(request),
        getTagsValueCompletions(itemProvider, request, block, collection),
    );
}

async function getSequenceValueCompletionIfInSeqLine(
    collection: TypedCollection,
    { documentHelper, filePath, position }: LanguageFeatureBaseRequest,
    itemType: BrunoFileType,
) {
    const { line } = position;
    const currentText = documentHelper.getLineByIndex(line);
    const sequencePattern = getLinePatternForDictionaryField(
        MetaBlockKey.Sequence,
    );

    if (!currentText.match(sequencePattern)) {
        return [];
    }

    const suggestedSequence = getSequenceValueCompletion(
        collection,
        filePath,
        itemType,
    );

    if (!suggestedSequence) {
        return [];
    }

    const completion: CompletionItem = {
        label: suggestedSequence.toString(),
        textEdit: {
            newText: ` ${suggestedSequence}`,
            range: new Range(
                new Position(line, currentText.indexOf(":") + 1),
                new Position(line, currentText.length),
            ),
        },
    };

    return [completion];
}

function getTagsValueCompletions(
    itemProvider: TypedCollectionItemProvider,
    { filePath, position }: LanguageFeatureBaseRequest,
    metaBlock: Block,
    collection?: TypedCollection,
) {
    const tagsField = getDictionaryBlockArrayField(
        metaBlock,
        MetaBlockKey.Tags,
    );
    if (!tagsField) {
        return [];
    }

    const isWithinValues = tagsField.plainTextWithinValues
        .map(({ range }) => range)
        .concat(tagsField.values.map(({ range }) => range))
        .some((range) => range.contains(position));

    if (!isWithinValues || !collection) {
        return [];
    }

    const tagsByCollections = getExistingRequestFileTags(itemProvider, {
        collection,
        pathToIgnore: filePath,
    });

    return tagsByCollections
        .filter(
            // Filter out already defined tags in the same document.
            ({ tag }) => tagsField.values.every(({ content: c }) => c != tag),
        )
        .map(
            ({
                tag,
                pathsInOwnCollection: inOwnCollection,
                inOtherCollections,
            }) => {
                const alreadyUsedInOwnCollection = inOwnCollection.length > 0;

                return {
                    label: tag,
                    labelDetails: {
                        description: alreadyUsedInOwnCollection
                            ? "Used in own collection"
                            : inOtherCollections.length == 1
                              ? `Used in collection '${basename(inOtherCollections[0].collection.getRootDirectory())}'`
                              : `Used in ${inOtherCollections.length} other collections`,
                    },
                    sortText: alreadyUsedInOwnCollection
                        ? `a_${tag}`
                        : `b_${tag}`,
                    kind: CompletionItemKind.Constant,
                };
            },
        );
}

function getRequestTypeValueCompletions(request: LanguageFeatureBaseRequest) {
    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    MetaBlockKey.Type,
                ),
                choices: Object.values(RequestType),
            },
        ],
        request,
    );
}
