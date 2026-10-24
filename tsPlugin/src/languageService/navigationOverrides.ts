import { extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { isPositionWithinCode } from "../codeBlocks/getCodeRanges";
import { isPositionWithinNameOfVariable } from "../codeBlocks/inbuiltFunctionParameters";
import { canReferToRuntimeDefinitions } from "../collection/runtimeContext";
import { isTempJsFileOrRuntimeDefinitionsFile } from "../constants";
import { hasEmbeddedCodeBlocks } from "../fileTypes";
import { PluginConfiguration } from "../pluginConfiguration";
import { grpcBruTypeNames } from "../runtimeDefinitions/getRuntimeDefinitionsFileContent";

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
                            isTypeForGrpcScripts(entry) ||
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
 * The types are only meant to be used for the parameters that shadow `bru` in code blocks (see `getBlockWrapperCandidates`).
 */
function isTypeForGrpcScripts({ name }: ts.CompletionEntry) {
    return Object.values(grpcBruTypeNames).includes(name);
}

/**
 * `req` and `res` are shadowed by parameters in code blocks, where they are not available (see `getBlockWrapperCandidates`).
 * Parameters of the same name that are declared within the code are still suggested.
 */
function isShadowingParameterOfCodeBlock(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
    fileName: string,
    position: number,
    { name, kind, source }: ts.CompletionEntry,
) {
    if (
        kind != ts.ScriptElementKind.parameterElement ||
        !["req", "res"].includes(name)
    ) {
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
        declaration.getSourceFile().fileName == fileName &&
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
            extname(fileName) != ".js" ||
            !canReferToRuntimeDefinitions(info, configuration, fileName)
        ) {
            return defaultRenameInfo;
        }

        const definitionForPosition =
            info.languageService.getDefinitionAtPosition(fileName, position);

        const isForInbuiltRuntimeFunction =
            definitionForPosition &&
            definitionForPosition.some(({ fileName }) =>
                isTempJsFileOrRuntimeDefinitionsFile(fileName),
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
        const defaultRenameLocations = info.languageService.findRenameLocations(
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
            canReferToRuntimeDefinitions(info, configuration, fileName)
            ? defaultRenameLocations.filter(
                  ({ fileName: fileForRenameLocation }) =>
                      !isTempJsFileOrRuntimeDefinitionsFile(
                          fileForRenameLocation,
                      ),
              )
            : defaultRenameLocations;
    };
}

export function overrideReferencesAndDefinitions(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
    configuration: PluginConfiguration,
) {
    proxy.findReferences = (fileName, position) => {
        const defaultReferences = info.languageService.findReferences(
            fileName,
            position,
        );

        return defaultReferences &&
            canReferToRuntimeDefinitions(info, configuration, fileName)
            ? defaultReferences.filter(
                  ({ definition: { fileName: fileForDefinition } }) =>
                      !isTempJsFileOrRuntimeDefinitionsFile(fileForDefinition),
              )
            : defaultReferences;
    };

    proxy.getDefinitionAtPosition = (fileName, position) => {
        const defaultDefinitions = info.languageService.getDefinitionAtPosition(
            fileName,
            position,
        );

        return defaultDefinitions &&
            canReferToRuntimeDefinitions(info, configuration, fileName)
            ? defaultDefinitions.filter(
                  ({ fileName: fileForDefinition }) =>
                      !isTempJsFileOrRuntimeDefinitionsFile(fileForDefinition),
              )
            : defaultDefinitions;
    };

    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
        const defaultDefinition =
            info.languageService.getDefinitionAndBoundSpan(fileName, position);

        return defaultDefinition &&
            canReferToRuntimeDefinitions(info, configuration, fileName) &&
            defaultDefinition.definitions
            ? {
                  ...defaultDefinition,
                  definitions: defaultDefinition.definitions.filter(
                      ({ fileName: fileForDefinition }) =>
                          !isTempJsFileOrRuntimeDefinitionsFile(
                              fileForDefinition,
                          ),
                  ),
              }
            : defaultDefinition;
    };

    proxy.getTypeDefinitionAtPosition = (fileName, position) => {
        const defaultDefinitions = info.languageService.getDefinitionAtPosition(
            fileName,
            position,
        );

        return defaultDefinitions &&
            canReferToRuntimeDefinitions(info, configuration, fileName)
            ? defaultDefinitions.filter(
                  ({ fileName: fileForDefinition }) =>
                      !isTempJsFileOrRuntimeDefinitionsFile(fileForDefinition),
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
            canReferToRuntimeDefinitions(info, configuration, fileName)
            ? defaultImplementations.filter(
                  ({ fileName: fileForImplementation }) =>
                      !isTempJsFileOrRuntimeDefinitionsFile(
                          fileForImplementation,
                      ),
              )
            : defaultImplementations;
    };
}
