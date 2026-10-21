import { getExistingRequestFileTags, TextDocumentHelper } from "@global_shared";
import { Hover } from "vscode-languageserver";
import { TypedCollection, TypedCollectionItemProvider } from ".";
import { getHoverForTagOccurences } from "./getHoverForTagOccurences";

/** Shows where else the given tag is used (apart from the file that is currently open). */
export function getHoverForExistingTag(
    tag: string,
    filePath: string,
    docHelper: TextDocumentHelper,
    {
        itemProvider,
        collection,
    }: {
        itemProvider: TypedCollectionItemProvider;
        collection: TypedCollection;
    },
): Hover | undefined {
    const tagOccurences = getExistingRequestFileTags(itemProvider, {
        collection,
        pathToIgnore: filePath,
    }).filter(({ tag: existingTag }) => existingTag == tag);

    return tagOccurences.length < 1
        ? { contents: "No other usages found." }
        : getHoverForTagOccurences(filePath, docHelper, tagOccurences[0]);
}
