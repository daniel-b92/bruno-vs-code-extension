import {
    Block,
    getDictionaryBlockArrayField,
    getExistingRequestFileTags,
    getMaxSequenceForRequests,
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

export async function getMetaBlockSpecificCompletions(
    itemProvider: TypedCollectionItemProvider,
    request: LanguageFeatureBaseRequest,
    metaBlock: Block,
    collection?: TypedCollection,
) {
    const { documentHelper, filePath, position } = request;

    const getSequenceFieldCompletion = async () => {
        const { line } = position;
        const currentText = documentHelper.getLineByIndex(line);
        const sequencePattern = new RegExp(
            `^\\s*${MetaBlockKey.Sequence}:.*$`,
            "m",
        );

        if (!currentText.match(sequencePattern)) {
            return [];
        }

        const suggestedSequence =
            ((await getMaxSequenceForRequests(
                itemProvider,
                dirname(filePath),
            )) ?? 0) + 1;

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
    };

    const getTagsFieldCompletions = () => {
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
                ({ tag }) =>
                    tagsField.values.every(({ content: c }) => c != tag),
            )
            .map(
                ({
                    tag,
                    pathsInOwnCollection: inOwnCollection,
                    inOtherCollections,
                }) => {
                    const alreadyUsedInOwnCollection =
                        inOwnCollection.length > 0;

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
    };

    const typeFieldCompletions = getFixedCompletionItems(
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

    return (await getSequenceFieldCompletion()).concat(
        typeFieldCompletions,
        getTagsFieldCompletions(),
    );
}
