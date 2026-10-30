import * as ts from "typescript/lib/tsserverlibrary";
import { CodeBlockName } from "../constants";

export function getCodeBlockIndizesForBruFile(fileContent: string) {
    const indizes: {
        blockName: CodeBlockName;
        startIndex: number;
        endIndex: number;
    }[] = [];

    for (const blockName of Object.values(CodeBlockName)) {
        const indizesForBlock = getCodeBlockStartAndEndIndex(
            fileContent,
            blockName,
        );

        if (indizesForBlock) {
            indizes.push({ blockName, ...indizesForBlock });
        }
    }

    return indizes;
}

function getCodeBlockStartAndEndIndex(
    fullTextContent: string,
    blockName: CodeBlockName,
) {
    const openingBracketChar = "{";

    const startPattern = new RegExp(
        `^\\s*${blockName}\\s*${openingBracketChar}\\s*$`,
        "m",
    );
    const startMatches = startPattern.exec(fullTextContent);

    if (!startMatches || startMatches.length == 0) {
        return undefined;
    }

    const blockStartIndex = startMatches.index;
    const remainingDoc = fullTextContent.substring(blockStartIndex);

    const sourceFile = ts.createSourceFile(
        "test.js",
        remainingDoc,
        ts.ScriptTarget.ES2020,
    );

    const blockNodeInSubDocument = (sourceFile as ts.Node)
        .getChildAt(0, sourceFile)
        .getChildren(sourceFile)
        .find(({ kind }) => kind == ts.SyntaxKind.Block);

    if (!blockNodeInSubDocument) {
        throw new Error(
            `Could not find code block within given subdocument: ${remainingDoc}`,
        );
    }

    return {
        startIndex:
            blockStartIndex + startMatches[0].indexOf(openingBracketChar) + 1,
        endIndex: blockStartIndex + blockNodeInSubDocument.end,
    };
}

/**
 * Only gRPC requests can have gRPC-specific code blocks, but other code blocks (e.g. `tests`) are available for gRPC requests as well.
 */
export function isGrpcRequestFile(fileContent: string) {
    const metaBlockContent = /^meta\s*\{([\s\S]*?)^\}/m.exec(fileContent)?.[1];

    return (
        /^\s*type\s*:\s*grpc\s*$/m.test(metaBlockContent ?? "") ||
        /^\s*script:grpc:[a-z-]+\s*\{\s*$/m.test(fileContent)
    );
}
