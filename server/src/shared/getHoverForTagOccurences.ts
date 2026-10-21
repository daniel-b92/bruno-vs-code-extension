import { TagOccurences, TextDocumentHelper } from "@global_shared";
import { basename } from "path";
import { Hover } from "vscode-languageserver";
import { AdditionalCollectionData } from "./interfaces";
import { wrapInCodeSpan } from "./markdown/wrapInCodeSpan";

export function getHoverForTagOccurences(
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
                ? `| ${wrapInCodeSpan("own")} | ${wrapInCodeSpan(`${pathsInOwnCollection.filter((path) => path != filePath).length} other file(s)`)} | ${lineBreak}`
                : "",
        )
        .concat(
            inOtherCollections.length > 0
                ? inOtherCollections
                      .map(
                          ({ collection, paths }) =>
                              `| ${wrapInCodeSpan(basename(collection.getRootDirectory()))} | ${wrapInCodeSpan(String(paths.length))} |`,
                      )
                      .join(lineBreak)
                : "",
        );

    return { contents: { kind: "markdown", value: content } };
}
