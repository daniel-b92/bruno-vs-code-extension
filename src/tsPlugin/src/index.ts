import { extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";

function init(_modules: {
    typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
    function create(info: ts.server.PluginCreateInfo) {
        // Set up decorator object
        const proxy: ts.LanguageService = Object.create(null);

        for (const k of Object.keys(
            info.languageService
        ) as (keyof ts.LanguageService)[]) {
            const x = info.languageService[k]!;
            // @ts-expect-error - JS runtime trickery which is tricky to type tersely
            proxy[k] = (...args: unknown[]) => x.apply(info.languageService, args);
        }

        proxy.getSyntacticDiagnostics = (fileName) => {
            return filterDefaultDiagnostics(
                info,
                fileName,
                info.languageService.getSyntacticDiagnostics(fileName)
            ) as ts.DiagnosticWithLocation[];
        };

        proxy.getSemanticDiagnostics = (fileName) => {
            return filterDefaultDiagnostics(
                info,
                fileName,
                info.languageService.getSemanticDiagnostics(fileName)
            );
        };

        return proxy;
    }

    return {
        create,
    };
}

function filterDefaultDiagnostics(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    defaultDiagnostics: (ts.Diagnostic | ts.DiagnosticWithLocation)[]
) {
    if (extname(fileName) != ".bru") {
        return defaultDiagnostics;
    } else {
        let fileContent: string | undefined = undefined;
        const scriptSnapshot =
            info.languageServiceHost.getScriptSnapshot(fileName);

        if (scriptSnapshot) {
            fileContent = scriptSnapshot.getText(0, scriptSnapshot.getLength());
        } else {
            fileContent = info.languageServiceHost.readFile(fileName);
        }

        if (!fileContent) {
            return [];
        }

        const indizes: {
            blockName: string;
            startIndex: number;
            endIndex: number;
        }[] = [];

        for (const blockName of Object.values(TextBlockName)) {
            const indizesForBlock = getTextBlockStartAndEndIndex(
                fileContent,
                blockName
            );

            if (indizesForBlock) {
                indizes.push({ blockName, ...indizesForBlock });
            }
        }

        if (indizes.length > 0) {
            return defaultDiagnostics.filter(
                ({ start, length }) =>
                    start != undefined &&
                    length != undefined &&
                    indizes.some(
                        ({ startIndex: blockStart, endIndex: blockEnd }) =>
                            start >= blockStart && start <= blockEnd
                    ) &&
                    // Do not show diagnostics for functions that are provided by Bruno at runtime
                    !["bru", "req", "res", "test", "expect"].includes(
                        fileContent.substring(start, start + length)
                    )
            );
        } else {
            return [];
        }
    }
}

function getTextBlockStartAndEndIndex(
    fullTextContent: string,
    blockName: TextBlockName
) {
    const openingBracketChar = "{";
    const closingBracketChar = "}";

    const startPattern = new RegExp(
        `^\\s*${blockName}\\s*${openingBracketChar}\\s*$`,
        "m"
    );
    const startMatches = startPattern.exec(fullTextContent);

    if (!startMatches || startMatches.length == 0) {
        return undefined;
    }

    const contentStartIndex =
        startMatches.index + startMatches[0].indexOf(openingBracketChar) + 1;

    const remainingDoc = fullTextContent.substring(contentStartIndex);
    const remainingDocLength = remainingDoc.length;
    let openBracketsOnBlockLevel = 1;
    let remainingDocCurrentIndex = 0;

    while (
        openBracketsOnBlockLevel > 0 &&
        remainingDocCurrentIndex < remainingDocLength
    ) {
        const currentChar = remainingDoc.charAt(remainingDocCurrentIndex);

        openBracketsOnBlockLevel +=
            currentChar == openingBracketChar
                ? 1
                : currentChar == closingBracketChar
                ? -1
                : 0;

        remainingDocCurrentIndex++;
    }

    if (openBracketsOnBlockLevel > 0) {
        return undefined;
    }

    return {
        startIndex: contentStartIndex,
        endIndex: remainingDocCurrentIndex + contentStartIndex,
    };
}

enum TextBlockName {
    Tests = "tests",
    PreRequestScript = "script:pre-request",
    PostResponseScript = "script:post-response",
}

export = init;
