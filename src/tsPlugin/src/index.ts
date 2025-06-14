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
            proxy[k] = (...args: unknown[]) =>
                // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                x.apply(info.languageService, args);
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

        proxy.getSuggestionDiagnostics = (fileName) => {
            const defaultDiagnostics =
                info.languageService.getSuggestionDiagnostics(fileName);

            if (!isBrunoFile(fileName)) {
                return defaultDiagnostics;
            }
            const allDiagnosticsForCodeBlocks = filterDefaultDiagnostics(
                info,
                fileName,
                defaultDiagnostics
            ) as ts.DiagnosticWithLocation[];

            // The ts server always reports errors when importing a Javascript function in a .bru file.
            return allDiagnosticsForCodeBlocks.filter(
                // Do not show diagnostics that only make sense for Typescript files.
                // Bru file code blocks should be treated like Javascript functions instead.
                // A list of diagnostics can be found here: https://github.com/microsoft/TypeScript/blob/main/src/compiler/diagnosticMessages.json
                ({ code }) => (code < 7_043 || code > 7_050) && code != 80_004
            );
        };

        // All hovers are provided by the extension implementation
        proxy.getQuickInfoAtPosition = (fileName, position) => {
            return isBrunoFile(fileName)
                ? undefined
                : info.languageService.getQuickInfoAtPosition(
                      fileName,
                      position
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
    if (!isBrunoFile(fileName)) {
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
                        (fileContent as string).substring(start, start + length)
                    ) &&
                    // Avoid showing incorrect error when using `require`
                    // (the error seems to only occur for short periods of time when typescript type definitions have not been reloaded for a while)
                    (fileContent as string).substring(start, start + length) !=
                        "require"
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

function isBrunoFile(fileName: string) {
    return extname(fileName) == ".bru";
}

enum TextBlockName {
    Tests = "tests",
    PreRequestScript = "script:pre-request",
    PostResponseScript = "script:post-response",
}

export = init;
