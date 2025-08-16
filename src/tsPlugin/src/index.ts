import { extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";

function init(_modules: {
    typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
    function create(info: ts.server.PluginCreateInfo) {
        // Set up decorator object
        const proxy: ts.LanguageService = Object.create(null);

        for (const k of Object.keys(
            info.languageService,
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
                info.languageService.getSyntacticDiagnostics(fileName),
            ) as ts.DiagnosticWithLocation[];
        };

        proxy.getSemanticDiagnostics = (fileName) => {
            return filterDefaultDiagnostics(
                info,
                fileName,
                info.languageService.getSemanticDiagnostics(fileName),
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
                defaultDiagnostics,
            ) as ts.DiagnosticWithLocation[];

            // The ts server always reports errors when importing a Javascript function in a .bru file.
            return allDiagnosticsForCodeBlocks.filter(
                // Do not show diagnostics that only make sense for Typescript files.
                // Bru file code blocks should be treated like Javascript functions instead.
                // A list of diagnostics can be found here: https://github.com/microsoft/TypeScript/blob/main/src/compiler/diagnosticMessages.json
                ({ code }) => (code < 7_043 || code > 7_050) && code != 80_004,
            );
        };

        // All hovers are provided by the extension implementation
        proxy.getQuickInfoAtPosition = (fileName, position) => {
            return isBrunoFile(fileName)
                ? undefined
                : info.languageService.getQuickInfoAtPosition(
                      fileName,
                      position,
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
    defaultDiagnostics: (ts.Diagnostic | ts.DiagnosticWithLocation)[],
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
            const indizesForBlock = getCodeBlockStartAndEndIndex(
                fileContent,
                blockName,
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
                            start >= blockStart && start <= blockEnd,
                    ) &&
                    // Do not show diagnostics for functions that are provided by Bruno at runtime
                    !["bru", "req", "res", "test", "expect"].includes(
                        (fileContent as string).substring(
                            start,
                            start + length,
                        ),
                    ) &&
                    // Avoid showing incorrect error when using `require`
                    // (the error seems to only occur for short periods of time when typescript type definitions have not been reloaded for a while)
                    (fileContent as string).substring(start, start + length) !=
                        "require",
            );
        } else {
            return [];
        }
    }
}

function getCodeBlockStartAndEndIndex(
    fullTextContent: string,
    blockName: TextBlockName,
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

function isBrunoFile(fileName: string) {
    return extname(fileName) == ".bru";
}

enum TextBlockName {
    Tests = "tests",
    PreRequestScript = "script:pre-request",
    PostResponseScript = "script:post-response",
}

export = init;
