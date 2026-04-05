import {
    Block,
    getDictionaryBlockArrayField,
    getExistingRequestFileTags,
    getMaxSequenceForRequests,
    getMetaBlockMandatoryKeys,
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
import { dirname, basename } from "path";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";
import { getKeyRangeContainingPosition } from "../generic/getKeyRangeContainingPosition";
import { getTextEditForKeyCompletion } from "../generic/getTextEditForKeyCompletion";
import { getKeysUsedInOtherLines } from "../generic/getKeysUsedInOtherLines";

export async function getMetaBlockSpecificCompletions(
    itemProvider: TypedCollectionItemProvider,
    request: LanguageFeatureBaseRequest,
    block: Block,
    collection?: TypedCollection,
): Promise<CompletionItem[]> {
    const keyRangeContainingPosition = getKeyRangeContainingPosition(
        request,
        block,
    );

    if (keyRangeContainingPosition != undefined) {
        return getMetaBlockMandatoryKeys()
            .filter(
                (mandatory) =>
                    !getKeysUsedInOtherLines(request, block).includes(
                        mandatory,
                    ),
            )
            .map((key) => ({
                label: key,
                textEdit: getTextEditForKeyCompletion(
                    keyRangeContainingPosition,
                    key,
                ),
            }));
    }

    return (await getSequenceValueCompletion(itemProvider, request)).concat(
        getRequestTypeValueCompletions(request),
        getTagsValueCompletions(itemProvider, request, block, collection),
    );
}

async function getSequenceValueCompletion(
    itemProvider: TypedCollectionItemProvider,
    { documentHelper, filePath, position }: LanguageFeatureBaseRequest,
) {
    const { line } = position;
    const currentText = documentHelper.getLineByIndex(line);
    const sequencePattern = getLinePatternForDictionaryField(
        MetaBlockKey.Sequence,
    );

    if (!currentText.match(sequencePattern)) {
        return [];
    }

    const suggestedSequence =
        ((await getMaxSequenceForRequests(itemProvider, dirname(filePath))) ??
            0) + 1;

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
