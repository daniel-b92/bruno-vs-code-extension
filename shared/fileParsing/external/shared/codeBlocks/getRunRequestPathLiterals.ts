import {
    BrunoFileType,
    CollectionFormat,
    ItemType,
    NonBrunoSpecificItemType,
    Position,
    Range,
    TextDocumentHelper,
} from "../../../..";
import { findFunctionCalls, FunctionIdentifier } from "./findFunctionCalls";
import { getJsCodeBlocksFromFile } from "./getJsCodeBlocksFromFile";

export type RunRequestPathQuote = '"' | "'" | "`";

export interface RunRequestPathLiteral {
    /** The text between the quotes. */
    path: string;
    /** The range of the text between the quotes. */
    range: Range;
    quote: RunRequestPathQuote;
    /** The script is defined as a single-line plain scalar in a Yaml file. Such a scalar has additional restrictions for the characters it may contain. */
    isInSingleLinePlainScalar: boolean;
}

const runRequestIdentifier: FunctionIdentifier = {
    baseIdentifier: "bru",
    functionName: "runRequest",
};

/**
 * Finds the paths of all calls like `bru.runRequest("folder/request")`, where the path is a string literal.
 * Literals that contain a backslash are skipped, because the text in the document would differ from the actual path.
 *
 * For Bruno files (requests, folder settings and collection settings), only the script and test blocks are searched.
 * For other files (`OtherFileType`, e.g. standalone JS files), the whole content is searched.
 */
export function getRunRequestPathLiterals(
    fileContent: string,
    itemType: ItemType,
    format: CollectionFormat,
): RunRequestPathLiteral[] {
    if (!fileContent.includes(runRequestIdentifier.functionName)) {
        return [];
    }

    const docHelper = new TextDocumentHelper(fileContent);

    if (itemType == NonBrunoSpecificItemType.OtherFileType) {
        return getLiteralsInContent(
            fileContent,
            docHelper,
            new Position(0, 0),
            false,
        );
    }

    if (
        itemType != BrunoFileType.RequestFile &&
        itemType != BrunoFileType.FolderSettingsFile &&
        itemType != BrunoFileType.CollectionSettingsFile
    ) {
        return [];
    }

    return getJsCodeBlocksFromFile(fileContent, itemType, format, {
        includeSingleLinePlainScalars: true,
    }).blocks.flatMap(({ content, contentRange, isSingleLinePlainScalar }) => {
        // The content may start within a line (e.g. a script defined as a single-line scalar). Padding it keeps all offsets relative to the start of the line.
        const startOfLine = new Position(contentRange.start.line, 0);

        return getLiteralsInContent(
            " ".repeat(contentRange.start.character).concat(content),
            docHelper,
            startOfLine,
            isSingleLinePlainScalar,
        );
    });
}

function getLiteralsInContent(
    content: string,
    docHelper: TextDocumentHelper,
    contentStartPosition: Position,
    isInSingleLinePlainScalar: boolean,
): RunRequestPathLiteral[] {
    return findFunctionCalls(content, [runRequestIdentifier]).flatMap(
        ({ firstParameter }) => {
            if (!firstParameter) {
                return [];
            }

            const quote = content.charAt(firstParameter.start);
            const path = content.substring(
                firstParameter.start + 1,
                firstParameter.end - 1,
            );
            const start = docHelper.getPositionForOffset(
                contentStartPosition,
                firstParameter.start + 1,
            );
            const end = docHelper.getPositionForOffset(
                contentStartPosition,
                firstParameter.end - 1,
            );

            if (!start || !end || !isQuote(quote) || path.includes("\\")) {
                return [];
            }

            return [
                {
                    path,
                    range: new Range(start, end),
                    quote,
                    isInSingleLinePlainScalar,
                },
            ];
        },
    );
}

function isQuote(character: string): character is RunRequestPathQuote {
    return character == '"' || character == "'" || character == "`";
}
