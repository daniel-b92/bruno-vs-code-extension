import * as ts from "typescript/lib/tsserverlibrary";
import { arePathsEqual, usesCaseSensitiveFileNames } from "../pathComparison";
import {
    createCheckForPositionsWithinCode,
    isPositionWithinCode,
} from "../codeBlocks/getCodeRanges";
import { isPositionWithinNameOfVariable } from "../codeBlocks/inbuiltFunctionParameters";
import { getRelativeModulePathCompletions } from "../codeBlocks/relativeModulePathCompletions";
import { canReferToRuntimeDefinitions } from "../collection/runtimeContext";
import { isTempJsFileOrRuntimeDefinitionsFile } from "../constants";
import { hasEmbeddedCodeBlocks, isJsFile } from "../fileTypes";
import { PluginConfiguration } from "../pluginConfiguration";
import {
    grpcBruTypeNames,
    wrapperVariableNames,
} from "../runtimeDefinitions/getRuntimeDefinitionsFileContent";

export function overrideHoverAndCompletions(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
    configuration: PluginConfiguration,
) {
    // The Typescript server only sees the masked content of '.bru' and '.yml' files, so there is nothing to provide outside of code blocks.
    const shouldProvideNothing = (fileName: string, position: number) =>
        hasEmbeddedCodeBlocks(fileName) &&
        !isPositionWithinCode(info, configuration, fileName, position);

    proxy.getQuickInfoAtPosition = (fileName, position, maximumLength) => {
        // Hovers for the names of variables are provided by the extension.
        if (
            shouldProvideNothing(fileName, position) ||
            (hasEmbeddedCodeBlocks(fileName) &&
                isPositionWithinNameOfVariable(info, fileName, position))
        ) {
            return undefined;
        }

        return info.languageService.getQuickInfoAtPosition(
            fileName,
            position,
            maximumLength,
        );
    };

    proxy.getCompletionsAtPosition = (
        fileName,
        position,
        options,
        formattingSettings,
    ) => {
        const hasCodeBlocks = hasEmbeddedCodeBlocks(fileName);

        // Completions for the names of variables are provided by the extension.
        if (
            shouldProvideNothing(fileName, position) ||
            (hasCodeBlocks &&
                isPositionWithinNameOfVariable(info, fileName, position))
        ) {
            return undefined;
        }

        // Paths are relative to the collection root folder and not to the file (like they would be for the Typescript server).
        const relativeModulePathCompletions = hasCodeBlocks
            ? getRelativeModulePathCompletions(info, fileName, position)
            : undefined;

        if (relativeModulePathCompletions) {
            return relativeModulePathCompletions;
        }

        const defaultCompletions =
            info.languageService.getCompletionsAtPosition(
                fileName,
                position,
                // Selecting an auto import would insert an import statement at the top of the file (outside of the code blocks).
                hasCodeBlocks
                    ? {
                          ...options,
                          includeCompletionsForModuleExports: false,
                          includeCompletionsForImportStatements: false,
                      }
                    : options,
                formattingSettings,
            );

        if (!defaultCompletions) {
            return defaultCompletions;
        }

        const isForRuntimeDefinitionsFile = ({ data }: ts.CompletionEntry) =>
            data?.fileName != undefined &&
            isTempJsFileOrRuntimeDefinitionsFile(data.fileName);

        return {
            ...defaultCompletions,
            entries: defaultCompletions.entries.filter(
                (entry) =>
                    !(
                        canReferToRuntimeDefinitions(
                            info,
                            configuration,
                            fileName,
                        ) && isForRuntimeDefinitionsFile(entry)
                    ) &&
                    !(
                        hasCodeBlocks &&
                        (entry.hasAction ||
                            isDeclarationForBlockWrappers(entry) ||
                            isShadowingParameterOfCodeBlock(
                                info,
                                configuration,
                                fileName,
                                position,
                                entry,
                            ))
                    ),
            ),
        };
    };

    proxy.getSignatureHelpItems = (fileName, position, options) =>
        shouldProvideNothing(fileName, position)
            ? undefined
            : info.languageService.getSignatureHelpItems(
                  fileName,
                  position,
                  options,
              );
}

/**
 * The types and variables are only meant to be used for wrapping code blocks (see `getBlockWrapperCandidates`).
 */
function isDeclarationForBlockWrappers({ name }: ts.CompletionEntry) {
    return [
        ...Object.values(grpcBruTypeNames),
        ...Object.values(wrapperVariableNames),
    ].includes(name);
}

/**
 * `res` is shadowed by a parameter in pre-request code blocks, where it is not available (see `getBlockWrapperCandidates`).
 * Parameters of the same name that are declared within the code are still suggested.
 */
function isShadowingParameterOfCodeBlock(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
    fileName: string,
    position: number,
    { name, kind, source }: ts.CompletionEntry,
) {
    if (kind != ts.ScriptElementKind.parameterElement || name != "res") {
        return false;
    }

    const declaration = info.languageService.getCompletionEntrySymbol(
        fileName,
        position,
        name,
        source,
    )?.declarations?.[0];

    return (
        declaration != undefined &&
        arePathsEqual(
            declaration.getSourceFile().fileName,
            fileName,
            usesCaseSensitiveFileNames(info),
        ) &&
        !isPositionWithinCode(
            info,
            configuration,
            fileName,
            declaration.getStart(),
        )
    );
}

export function overrideRename(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
    configuration: PluginConfiguration,
) {
    proxy.getRenameInfo = (fileName, position, preferences) => {
        const defaultRenameInfo = info.languageService.getRenameInfo(
            fileName,
            position,
            preferences as ts.UserPreferences,
        );

        if (
            !defaultRenameInfo.canRename ||
            !(isJsFile(fileName) || hasEmbeddedCodeBlocks(fileName))
        ) {
            return defaultRenameInfo;
        }

        const isLocationShown = createFilterForShownLocations(
            info,
            configuration,
            fileName,
        );

        // Renaming them would change all usages in the project (or the wrappers of code blocks).
        const isForInbuiltRuntimeFunction = info.languageService
            .getDefinitionAtPosition(fileName, position)
            ?.some(
                ({ fileName: fileForDefinition, textSpan }) =>
                    !isLocationShown(fileForDefinition, textSpan),
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
        const isLocationShown = createFilterForShownLocations(
            info,
            configuration,
            fileName,
        );

        return info.languageService
            .findRenameLocations(
                fileName,
                position,
                findInStrings,
                findInComments,
                providePrefixAndSuffixTextForRename &&
                    typeof providePrefixAndSuffixTextForRename != "boolean"
                    ? providePrefixAndSuffixTextForRename
                    : {},
            )
            ?.filter(({ fileName: fileForRenameLocation, textSpan }) =>
                isLocationShown(fileForRenameLocation, textSpan),
            );
    };
}

export function overrideReferencesAndDefinitions(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
    configuration: PluginConfiguration,
) {
    const filterLocations = <
        T extends { fileName: string; textSpan: ts.TextSpan },
    >(
        requestedFileName: string,
        locations: readonly T[] | undefined,
    ) => {
        const isLocationShown = createFilterForShownLocations(
            info,
            configuration,
            requestedFileName,
        );

        return locations?.filter(({ fileName, textSpan }) =>
            isLocationShown(fileName, textSpan),
        );
    };

    proxy.findReferences = (fileName, position) => {
        const isLocationShown = createFilterForShownLocations(
            info,
            configuration,
            fileName,
        );

        return info.languageService
            .findReferences(fileName, position)
            ?.filter(({ definition }) =>
                isLocationShown(definition.fileName, definition.textSpan),
            )
            .map((referencedSymbol) => ({
                ...referencedSymbol,
                references: referencedSymbol.references.filter(
                    ({ fileName: fileForReference, textSpan }) =>
                        isLocationShown(fileForReference, textSpan),
                ),
            }));
    };

    proxy.getDefinitionAtPosition = (fileName, position) =>
        filterLocations(
            fileName,
            info.languageService.getDefinitionAtPosition(fileName, position),
        );

    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
        const defaultDefinition =
            info.languageService.getDefinitionAndBoundSpan(fileName, position);

        return (
            defaultDefinition && {
                ...defaultDefinition,
                definitions: filterLocations(
                    fileName,
                    defaultDefinition.definitions,
                ),
            }
        );
    };

    proxy.getTypeDefinitionAtPosition = (fileName, position) =>
        filterLocations(
            fileName,
            info.languageService.getDefinitionAtPosition(fileName, position),
        );

    proxy.getImplementationAtPosition = (fileName, position) =>
        filterLocations(
            fileName,
            info.languageService.getImplementationAtPosition(
                fileName,
                position,
            ),
        );

    proxy.getDocumentHighlights = (fileName, position, filesToSearch) => {
        const isLocationShown = createFilterForShownLocations(
            info,
            configuration,
            fileName,
        );

        return info.languageService
            .getDocumentHighlights(fileName, position, filesToSearch)
            ?.map((highlights) => ({
                ...highlights,
                highlightSpans: highlights.highlightSpans.filter(
                    ({ textSpan }) =>
                        isLocationShown(highlights.fileName, textSpan),
                ),
            }))
            .filter(({ highlightSpans }) => highlightSpans.length > 0);
    };
}

/**
 * Returns a function that determines whether a location from the results of the Typescript server for the requested file can be shown to the user.
 * The virtual file with the runtime definitions does not exist on the disk. For `.bru` and Yaml files, only the code is visible to the user,
 * while the Typescript server also sees the wrappers of the code blocks (see `getBlockWrapperCandidates`).
 */
function createFilterForShownLocations(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
    requestedFileName: string,
) {
    const shouldHideRuntimeDefinitions = canReferToRuntimeDefinitions(
        info,
        configuration,
        requestedFileName,
    );
    const isWithinCode = createCheckForPositionsWithinCode(info, configuration);

    return (fileName: string, { start }: ts.TextSpan) =>
        !(
            shouldHideRuntimeDefinitions &&
            isTempJsFileOrRuntimeDefinitionsFile(fileName)
        ) &&
        (!hasEmbeddedCodeBlocks(fileName) || isWithinCode(fileName, start));
}
