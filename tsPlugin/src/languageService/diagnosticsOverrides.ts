import * as ts from "typescript/lib/tsserverlibrary";
import { canReferToRuntimeDefinitions } from "../collection/runtimeContext";
import { filterAwaitInBlockWrappers } from "../diagnostics/filterAwaitInBlockWrappers";
import { filterDefaultDiagnostics } from "../diagnostics/filterDefaultDiagnostics";
import { hasEmbeddedCodeBlocks } from "../fileTypes";
import { enableTypeCheckingForJsFile } from "../languageServiceHost/enableTypeCheckingForJsFile";
import { PluginConfiguration } from "../pluginConfiguration";

export function overrideDiagnostics(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
    configuration: PluginConfiguration,
) {
    proxy.getSyntacticDiagnostics = (fileName) => {
        return filterDefaultDiagnostics(
            info,
            configuration,
            fileName,
            info.languageService.getSyntacticDiagnostics(fileName),
        ) as ts.DiagnosticWithLocation[];
    };

    proxy.getSemanticDiagnostics = (fileName) => {
        const hasCodeBlocks = hasEmbeddedCodeBlocks(fileName);

        if (hasCodeBlocks) {
            enableTypeCheckingForJsFile(info, fileName);
        }

        const allDiagnostics = filterDefaultDiagnostics(
            info,
            configuration,
            fileName,
            info.languageService.getSemanticDiagnostics(fileName),
        );

        // The ts server always reports errors when importing a Javascript function in a .bru or .yml file.
        return hasCodeBlocks
            ? filterAwaitInBlockWrappers(
                  info,
                  fileName,
                  allDiagnostics.filter(
                      // Do not show diagnostics that only make sense for Typescript files.
                      // Code blocks should be treated like Javascript functions instead.
                      // A list of diagnostics can be found here: https://github.com/microsoft/TypeScript/blob/main/src/compiler/diagnosticMessages.json
                      ({ code }) =>
                          ![
                              7_006, 7_031, 18_046,
                              // Code blocks that could not be wrapped in a function (see `getBlockWrapperCandidates`) are handled as normal blocks.
                              // For these, `return` and top-level `await` are reported as errors.
                              1_108,
                              1_375, 1_378,
                          ].includes(code),
                  ),
              )
            : allDiagnostics;
    };

    proxy.getSuggestionDiagnostics = (fileName) => {
        const defaultDiagnostics =
            info.languageService.getSuggestionDiagnostics(fileName);

        const hasCodeBlocks = hasEmbeddedCodeBlocks(fileName);

        const allDiagnostics = filterDefaultDiagnostics(
            info,
            configuration,
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
            : canReferToRuntimeDefinitions(info, configuration, fileName)
              ? allDiagnostics.filter(({ code }) => code != 80_001)
              : allDiagnostics; // Bruno currently only supports CommonJS modules.)
    };
}
