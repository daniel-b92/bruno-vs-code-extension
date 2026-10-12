import { dirname, extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import {
    maskYamlCollectionFileContent,
    maskYamlFileContent,
} from "./yamlFiles/maskYamlFileContent";

function init(_modules: {
    typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
    function create(info: ts.server.PluginCreateInfo) {
        maskYamlFilesForTypescriptServer(info);

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
            const hasCodeBlocks = hasEmbeddedCodeBlocks(fileName);

            const allDiagnostics = filterDefaultDiagnostics(
                info,
                fileName,
                info.languageService.getSemanticDiagnostics(fileName),
            );

            // The ts server always reports errors when importing a Javascript function in a .bru or .yml file.
            return hasCodeBlocks
                ? allDiagnostics.filter(
                      // Do not show diagnostics that only make sense for Typescript files.
                      // Code blocks should be treated like Javascript functions instead.
                      // A list of diagnostics can be found here: https://github.com/microsoft/TypeScript/blob/main/src/compiler/diagnosticMessages.json
                      ({ code }) => ![7_006, 7_031, 18_046].includes(code),
                  )
                : allDiagnostics;
        };

        proxy.getSuggestionDiagnostics = (fileName) => {
            const defaultDiagnostics =
                info.languageService.getSuggestionDiagnostics(fileName);

            const hasCodeBlocks = hasEmbeddedCodeBlocks(fileName);

            const allDiagnostics = filterDefaultDiagnostics(
                info,
                fileName,
                defaultDiagnostics,
            ) as ts.DiagnosticWithLocation[];

            // The ts server always reports errors when importing a Javascript function in a .bru or .yml file.
            return hasCodeBlocks
                ? allDiagnostics.filter(
                      // Do not show diagnostics that only make sense for Typescript files.
                      // Code blocks should be treated like Javascript functions instead.
                      // A list of diagnostics can be found here: https://github.com/microsoft/TypeScript/blob/main/src/compiler/diagnosticMessages.json
                      ({ code }) =>
                          (code < 7_043 || code > 7_050) &&
                          code != 80_001 &&
                          code != 80_004,
                  )
                : isInABrunoCollection(info, fileName)
                  ? allDiagnostics.filter(({ code }) => code != 80_001)
                  : allDiagnostics; // Bruno currently only supports CommonJS modules.)
        };

        // All hovers are provided by the extension implementation for '.bru' and '.yml' files.
        proxy.getQuickInfoAtPosition = (fileName, position) => {
            if (hasEmbeddedCodeBlocks(fileName)) {
                return undefined;
            }

            return info.languageService.getQuickInfoAtPosition(
                fileName,
                position,
            );
        };

        proxy.getCompletionsAtPosition = (fileName, position, options) => {
            // All completions are provided by the extension implementation for '.bru' and '.yml' files.
            if (hasEmbeddedCodeBlocks(fileName)) {
                return undefined;
            }

            const defaultCompletions =
                info.languageService.getCompletionsAtPosition(
                    fileName,
                    position,
                    options,
                );

            return defaultCompletions && isInABrunoCollection(info, fileName)
                ? {
                      ...defaultCompletions,
                      entries: defaultCompletions.entries.filter(
                          ({ data }) =>
                              !data ||
                              !data.fileName ||
                              !data.fileName.includes(
                                  getTempJsFileBaseNameWithoutExtension(),
                              ),
                      ),
                  }
                : defaultCompletions;
        };

        proxy.getRenameInfo = (fileName, position, preferences) => {
            const defaultRenameInfo = info.languageService.getRenameInfo(
                fileName,
                position,
                preferences as ts.UserPreferences,
            );

            if (
                extname(fileName) != ".js" ||
                !isInABrunoCollection(info, fileName)
            ) {
                return defaultRenameInfo;
            }

            const definitionForPosition =
                info.languageService.getDefinitionAtPosition(
                    fileName,
                    position,
                );

            const isForInbuiltRuntimeFunction =
                definitionForPosition &&
                definitionForPosition.some(({ fileName }) =>
                    fileName.includes(getTempJsFileBaseNameWithoutExtension()),
                );

            return isForInbuiltRuntimeFunction
                ? {
                      canRename: false,
                      localizedErrorMessage:
                          "You cannot rename elements that are provided by Bruno at runtime.",
                  }
                : defaultRenameInfo;
        };

        proxy.findRenameLocations = (
            fileName,
            position,
            findInStrings,
            findInComments,
            providePrefixAndSuffixTextForRename,
        ) => {
            const defaultRenameLocations =
                info.languageService.findRenameLocations(
                    fileName,
                    position,
                    findInStrings,
                    findInComments,
                    providePrefixAndSuffixTextForRename &&
                        typeof providePrefixAndSuffixTextForRename != "boolean"
                        ? providePrefixAndSuffixTextForRename
                        : {},
                );

            return defaultRenameLocations &&
                isInABrunoCollection(info, fileName)
                ? defaultRenameLocations.filter(
                      ({ fileName: fileForRenameLocation }) =>
                          !fileForRenameLocation.includes(
                              getTempJsFileBaseNameWithoutExtension(),
                          ),
                  )
                : defaultRenameLocations;
        };

        proxy.findReferences = (fileName, position) => {
            const defaultReferences = info.languageService.findReferences(
                fileName,
                position,
            );

            return defaultReferences && isInABrunoCollection(info, fileName)
                ? defaultReferences.filter(
                      ({ definition: { fileName: fileForDefinition } }) =>
                          !fileForDefinition.includes(
                              getTempJsFileBaseNameWithoutExtension(),
                          ),
                  )
                : defaultReferences;
        };

        proxy.getDefinitionAtPosition = (fileName, position) => {
            const defaultDefinitions =
                info.languageService.getDefinitionAtPosition(
                    fileName,
                    position,
                );

            return defaultDefinitions && isInABrunoCollection(info, fileName)
                ? defaultDefinitions.filter(
                      ({ fileName: fileForDefinition }) =>
                          !fileForDefinition.includes(
                              getTempJsFileBaseNameWithoutExtension(),
                          ),
                  )
                : defaultDefinitions;
        };

        proxy.getDefinitionAndBoundSpan = (fileName, position) => {
            const defaultDefinition =
                info.languageService.getDefinitionAndBoundSpan(
                    fileName,
                    position,
                );

            return defaultDefinition &&
                isInABrunoCollection(info, fileName) &&
                defaultDefinition.definitions
                ? {
                      ...defaultDefinition,
                      definitions: defaultDefinition.definitions.filter(
                          ({ fileName: fileForDefinition }) =>
                              !fileForDefinition.includes(
                                  getTempJsFileBaseNameWithoutExtension(),
                              ),
                      ),
                  }
                : defaultDefinition;
        };

        proxy.getTypeDefinitionAtPosition = (fileName, position) => {
            const defaultDefinitions =
                info.languageService.getDefinitionAtPosition(
                    fileName,
                    position,
                );

            return defaultDefinitions && isInABrunoCollection(info, fileName)
                ? defaultDefinitions.filter(
                      ({ fileName: fileForDefinition }) =>
                          !fileForDefinition.includes(
                              getTempJsFileBaseNameWithoutExtension(),
                          ),
                  )
                : defaultDefinitions;
        };

        proxy.getImplementationAtPosition = (fileName, position) => {
            const defaultImplementations =
                info.languageService.getImplementationAtPosition(
                    fileName,
                    position,
                );

            return defaultImplementations &&
                isInABrunoCollection(info, fileName)
                ? defaultImplementations.filter(
                      ({ fileName: fileForImplementation }) =>
                          !fileForImplementation.includes(
                              getTempJsFileBaseNameWithoutExtension(),
                          ),
                  )
                : defaultImplementations;
        };

        return proxy;
    }

    return {
        create,
    };
}

const hostsWithMaskedYamlFiles = new WeakSet<ts.LanguageServiceHost>();

/**
 * The Typescript server parses Yaml files like Typescript files, so that the Yaml content would affect the meaning of the code within scripts.
 * Therefore, the Typescript server only gets to see the code of scripts within Yaml collection files (see `maskYamlCollectionFileContent`).
 * All other Yaml files are masked completely.
 */
function maskYamlFilesForTypescriptServer(info: ts.server.PluginCreateInfo) {
    const host = info.languageServiceHost;

    // Masking already masked content would remove all scripts.
    if (hostsWithMaskedYamlFiles.has(host)) {
        return;
    }

    hostsWithMaskedYamlFiles.add(host);

    const getOriginalSnapshot = host.getScriptSnapshot.bind(host);
    // A new snapshot is only created, if the content of a file changes.
    const maskedSnapshots = new WeakMap<
        ts.IScriptSnapshot,
        ts.IScriptSnapshot
    >();

    host.getScriptSnapshot = (fileName) => {
        const originalSnapshot = getOriginalSnapshot(fileName);

        if (!originalSnapshot || !isYamlFile(fileName)) {
            return originalSnapshot;
        }

        const cachedSnapshot = maskedSnapshots.get(originalSnapshot);

        if (cachedSnapshot) {
            return cachedSnapshot;
        }

        const originalContent = originalSnapshot.getText(
            0,
            originalSnapshot.getLength(),
        );

        // Snapshots created from a string do not support incremental parsing, so the file is always parsed completely.
        const maskedSnapshot = ts.ScriptSnapshot.fromString(
            isFileFromYamlCollection(info, fileName)
                ? maskYamlCollectionFileContent(originalContent)
                : maskYamlFileContent(originalContent),
        );

        maskedSnapshots.set(originalSnapshot, maskedSnapshot);

        return maskedSnapshot;
    };
}

function filterDefaultDiagnostics(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    defaultDiagnostics: (ts.Diagnostic | ts.DiagnosticWithLocation)[],
) {
    if (isYamlFile(fileName)) {
        return filterDiagnosticsForYamlFile(info, fileName, defaultDiagnostics);
    } else if (!isBruFile(fileName)) {
        return extname(fileName) == ".js"
            ? filterDiagnosticsForJsFile(info, fileName, defaultDiagnostics)
            : defaultDiagnostics;
    }

    const fileContent = getFileContent(info, fileName);

    if (!fileContent) {
        return [];
    }

    const indizes: {
        blockName: string;
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

    if (indizes.length == 0) {
        return [];
    }

    return filterOutDiagnosticsForInbuiltRuntimeFunctions(
        defaultDiagnostics.filter(
            ({ start }) =>
                start != undefined &&
                indizes.some(
                    ({ startIndex: blockStart, endIndex: blockEnd }) =>
                        start >= blockStart && start <= blockEnd,
                ),
        ),
        fileContent,
    );
}

/**
 * The Typescript server only sees the code of scripts within Yaml files (see `maskYamlFilesForTypescriptServer`).
 * Therefore, all diagnostics are already located within code blocks.
 */
function filterDiagnosticsForYamlFile(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    defaultDiagnostics: (ts.Diagnostic | ts.DiagnosticWithLocation)[],
) {
    const fileContent = getFileContent(info, fileName);

    return fileContent
        ? filterOutDiagnosticsForInbuiltRuntimeFunctions(
              defaultDiagnostics,
              fileContent,
          )
        : [];
}

function filterDiagnosticsForJsFile(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    defaultDiagnostics: (ts.Diagnostic | ts.DiagnosticWithLocation)[],
) {
    if (fileName.includes(getTempJsFileBaseNameWithoutExtension())) {
        // Filter out all diagnostics for temp js files.
        return [];
    } else if (!isInABrunoCollection(info, fileName)) {
        return defaultDiagnostics;
    }

    const fileContent = getFileContent(info, fileName);

    if (!fileContent) {
        return [];
    }

    const filteredDiagnostics = filterOutDiagnosticsForInbuiltRuntimeFunctions(
        defaultDiagnostics,
        fileContent,
    );

    return filteredDiagnostics.map((diagnostic) => {
        const { relatedInformation } = diagnostic;

        const referencesTempJsFile =
            relatedInformation &&
            relatedInformation.some(
                ({ file }) =>
                    file &&
                    file.fileName.endsWith(
                        `${getTempJsFileBaseNameWithoutExtension()}.js`,
                    ),
            );

        return referencesTempJsFile
            ? { ...diagnostic, relatedInformation: undefined }
            : diagnostic;
    });
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

function filterOutDiagnosticsForInbuiltRuntimeFunctions(
    diagnosticsToFilter: (ts.Diagnostic | ts.DiagnosticWithLocation)[],
    fileContent: string,
) {
    return filterOutMisleadingDiagnosticsForOtherTestFrameworks(
        diagnosticsToFilter,
    ).filter(
        ({ start, length }) =>
            start != undefined &&
            length != undefined &&
            // Do not show diagnostics for functions that are provided by Bruno at runtime
            !getNamesForInbuiltRuntimeVarsAndFunctions().includes(
                fileContent.substring(start, start + length),
            ) &&
            // Avoid showing incorrect error when using `require`
            // (the error seems to only occur for short periods of time when typescript type definitions have not been reloaded for a while)
            fileContent.substring(start, start + length) != "require",
    );
}

function filterOutMisleadingDiagnosticsForOtherTestFrameworks(
    diagnostics: (ts.Diagnostic | ts.DiagnosticWithLocation)[],
) {
    return diagnostics.filter(({ code, messageText }) => {
        const errorText =
            typeof messageText == "string"
                ? messageText
                : messageText.messageText;

        // When using global type definitions for Jest, the TS server expects every `expect` statement to use the matchers for Jest.
        return code != 2_339 || !errorText.includes("JestMatchers<any>");
    });
}

function getFileContent(info: ts.server.PluginCreateInfo, fileName: string) {
    const scriptSnapshot = info.languageServiceHost.getScriptSnapshot(fileName);

    if (scriptSnapshot) {
        return scriptSnapshot.getText(0, scriptSnapshot.getLength());
    } else {
        return info.languageServiceHost.readFile(fileName);
    }
}

function isInABrunoCollection(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    return getFormatOfContainingCollection(info, fileName) != undefined;
}

/**
 * Collection files in the Yaml format always use the extension `.yml`.
 */
function isFileFromYamlCollection(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    return (
        extname(fileName) == ".yml" &&
        getFormatOfContainingCollection(info, fileName) ==
            CollectionFormat.Yaml
    );
}

function getFormatOfContainingCollection(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    let currentDirectory = dirname(fileName);
    let format = getFormatIfCollectionRootFolder(info, currentDirectory);

    while (
        info.serverHost.directoryExists(currentDirectory) &&
        !format &&
        dirname(currentDirectory) != currentDirectory // dirname of a base folder in the file system seems to return the input folder again
    ) {
        currentDirectory = dirname(currentDirectory);
        format = getFormatIfCollectionRootFolder(info, currentDirectory);
    }

    return format;
}

function getFormatIfCollectionRootFolder(
    info: ts.server.PluginCreateInfo,
    directoryPath: string,
) {
    const collectionRootFile = info.serverHost
        .readDirectory(directoryPath, undefined, undefined, undefined, 1)
        .find((fileName) => {
            const isBruCollectionRootFile = fileName.endsWith("bruno.json");
            const isYamlCollectionRootFile =
                fileName.endsWith("opencollection.yml");

            if (!isBruCollectionRootFile && !isYamlCollectionRootFile) {
                return false;
            }

            const content = info.languageServiceHost.readFile(fileName);

            if (!content) {
                return false;
            }

            return isBruCollectionRootFile
                ? isBrunoJsonForCollection(content)
                : isOpenCollectionRootFileContent(content);
        });

    if (!collectionRootFile) {
        return undefined;
    }

    return collectionRootFile.endsWith("bruno.json")
        ? CollectionFormat.Bru
        : CollectionFormat.Yaml;
}

function isBrunoJsonForCollection(content: string) {
    try {
        const parsedContent = JSON.parse(content) as
            { type: string } | undefined;

        return parsedContent && parsedContent.type == "collection";
    } catch {
        return false;
    }
}

/**
 * Request, folder and environment files can be named `opencollection.yml` as well.
 * Only the actual collection root file defines the top-level key `opencollection`.
 */
function isOpenCollectionRootFileContent(content: string) {
    return /^opencollection\s*:/m.test(content);
}

function hasEmbeddedCodeBlocks(fileName: string) {
    return isBruFile(fileName) || isYamlFile(fileName);
}

function isBruFile(fileName: string) {
    return extname(fileName) == ".bru";
}

function isYamlFile(fileName: string) {
    return [".yml", ".yaml"].includes(extname(fileName));
}

function getTempJsFileBaseNameWithoutExtension() {
    return "__temp_bru_reference";
}

function getNamesForInbuiltRuntimeVarsAndFunctions() {
    return ["bru", "req", "res", "test", "expect"];
}

enum CollectionFormat {
    Bru = "bru",
    Yaml = "yaml",
}

enum CodeBlockName {
    Tests = "tests",
    PreRequestScript = "script:pre-request",
    PostResponseScript = "script:post-response",
    GrpcBeforeCallStartScript = "script:grpc:before-call-start",
    GrpcBeforeMessageSendScript = "script:grpc:before-message-send",
    GrpcAfterMessageReceiveScript = "script:grpc:after-message-receive",
    GrpcAfterCallEndScript = "script:grpc:after-call-end",
}

export = init;
