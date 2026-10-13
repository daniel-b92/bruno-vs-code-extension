import { extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { isInABrunoCollection } from "../collection/collectionFormat";
import { getTempJsFileBaseNameWithoutExtension } from "../constants";
import { hasEmbeddedCodeBlocks } from "../fileTypes";

export function overrideHoverAndCompletions(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
) {
    // All hovers are provided by the extension implementation for '.bru' and '.yml' files.
    proxy.getQuickInfoAtPosition = (fileName, position) => {
        if (hasEmbeddedCodeBlocks(fileName)) {
            return undefined;
        }

        return info.languageService.getQuickInfoAtPosition(fileName, position);
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
}

export function overrideRename(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
) {
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
            info.languageService.getDefinitionAtPosition(fileName, position);

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

        return defaultRenameLocations && isInABrunoCollection(info, fileName)
            ? defaultRenameLocations.filter(
                  ({ fileName: fileForRenameLocation }) =>
                      !fileForRenameLocation.includes(
                          getTempJsFileBaseNameWithoutExtension(),
                      ),
              )
            : defaultRenameLocations;
    };
}

export function overrideReferencesAndDefinitions(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
) {
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
        const defaultDefinitions = info.languageService.getDefinitionAtPosition(
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
            info.languageService.getDefinitionAndBoundSpan(fileName, position);

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
        const defaultDefinitions = info.languageService.getDefinitionAtPosition(
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

        return defaultImplementations && isInABrunoCollection(info, fileName)
            ? defaultImplementations.filter(
                  ({ fileName: fileForImplementation }) =>
                      !fileForImplementation.includes(
                          getTempJsFileBaseNameWithoutExtension(),
                      ),
              )
            : defaultImplementations;
    };
}
