import { extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { getCodeBlockIndizesForBruFile } from "../codeBlocks/bruCodeBlocks";
import { isInABrunoCollection } from "../collection/collectionFormat";
import {
    getNamesForInbuiltRuntimeVarsAndFunctions,
    getTempJsFileBaseNameWithoutExtension,
} from "../constants";
import { getFileContent } from "../fileContent";
import { isBruFile, isYamlFile } from "../fileTypes";

type AnyDiagnostic = ts.Diagnostic | ts.DiagnosticWithLocation;

export function filterDefaultDiagnostics(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    defaultDiagnostics: AnyDiagnostic[],
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
 * The Typescript server only sees the code of scripts within Yaml files (see `maskYamlFilesForTypescriptServer`).
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
    fileName: string,
    defaultDiagnostics: AnyDiagnostic[],
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

function filterOutDiagnosticsForInbuiltRuntimeFunctions(
    diagnosticsToFilter: AnyDiagnostic[],
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
