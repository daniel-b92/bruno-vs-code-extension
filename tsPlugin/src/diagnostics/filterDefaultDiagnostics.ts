import { extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { getCodeBlockIndizesForBruFile } from "../codeBlocks/bruCodeBlocks";
import { canReferToRuntimeDefinitions } from "../collection/runtimeContext";
import {
    getNamesForInbuiltRuntimeVarsAndFunctions,
    isTempJsFileOrRuntimeDefinitionsFile,
} from "../constants";
import { getFileContent, getOriginalFileContent } from "../fileContent";
import { isBruFile, isYamlFile } from "../fileTypes";
import { PluginConfiguration } from "../pluginConfiguration";

type AnyDiagnostic = ts.Diagnostic | ts.DiagnosticWithLocation;

export function filterDefaultDiagnostics(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
    fileName: string,
    defaultDiagnostics: AnyDiagnostic[],
) {
    if (isYamlFile(fileName)) {
        return filterDiagnosticsForYamlFile(info, fileName, defaultDiagnostics);
    } else if (!isBruFile(fileName)) {
        return extname(fileName) == ".js"
            ? filterDiagnosticsForJsFile(
                  info,
                  configuration,
                  fileName,
                  defaultDiagnostics,
              )
            : defaultDiagnostics;
    }

    // The Typescript server only sees the code blocks of `.bru` files (see `maskBruFileContent`), but the blocks are identified in the original content.
    const fileContent = getOriginalFileContent(info, fileName);

    if (!fileContent) {
        return [];
    }

    const indizes = getCodeBlockIndizesForBruFile(fileContent);

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
 * The Typescript server only sees the code of scripts within Yaml files (see `maskFilesWithCodeBlocksForTypescriptServer`).
 * Therefore, all diagnostics are already located within code blocks.
 */
function filterDiagnosticsForYamlFile(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    defaultDiagnostics: AnyDiagnostic[],
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
    configuration: PluginConfiguration,
    fileName: string,
    defaultDiagnostics: AnyDiagnostic[],
) {
    if (isTempJsFileOrRuntimeDefinitionsFile(fileName)) {
        // Filter out all diagnostics for temp js files and the virtual file with the runtime definitions.
        return [];
    } else if (!canReferToRuntimeDefinitions(info, configuration, fileName)) {
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
                    file && isTempJsFileOrRuntimeDefinitionsFile(file.fileName),
            );

        return referencesTempJsFile
            ? { ...diagnostic, relatedInformation: undefined }
            : diagnostic;
    });
}

function filterOutDiagnosticsForInbuiltRuntimeFunctions(
    diagnosticsToFilter: AnyDiagnostic[],
    fileContent: string,
) {
    return filterOutMisleadingDiagnosticsForOtherTestFrameworks(
        diagnosticsToFilter,
    ).filter(
        ({ start, length, code }) =>
            start != undefined &&
            length != undefined &&
            // The types for the objects that are provided by Bruno at runtime are known (see `provideRuntimeDefinitions`).
            // So the diagnostics are only filtered out as a safeguard, if they are reported as unknown anyway.
            !(
                isDiagnosticForUnknownName(code) &&
                getNamesForInbuiltRuntimeVarsAndFunctions().includes(
                    fileContent.substring(start, start + length),
                )
            ) &&
            // Avoid showing incorrect error when using `require`
            // (the error seems to only occur for short periods of time when typescript type definitions have not been reloaded for a while)
            fileContent.substring(start, start + length) != "require",
    );
}

function isDiagnosticForUnknownName(code: number) {
    // 2582: Cannot find name 'x'. Do you need to install type definitions for a test runner?
    return [2_304, 2_582].includes(code);
}

function filterOutMisleadingDiagnosticsForOtherTestFrameworks(
    diagnostics: AnyDiagnostic[],
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
