import { basename } from "path";
import { getExistingTags } from "@global_shared";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { TypedCollection, TypedCollectionItemProvider } from "./interfaces";

export function getTagCompletions({
    itemProvider,
    collection,
    filePath,
    alreadyDefinedTags,
}: {
    itemProvider: TypedCollectionItemProvider;
    collection: TypedCollection;
    filePath: string;
    alreadyDefinedTags: string[];
}): CompletionItem[] {
    return getExistingTags(itemProvider, {
        collection,
        pathToIgnore: filePath,
    })
        .filter(({ tag }) => !alreadyDefinedTags.includes(tag))
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
