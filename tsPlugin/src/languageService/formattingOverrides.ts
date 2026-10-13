import * as ts from "typescript/lib/tsserverlibrary";
import { isYamlFile } from "../fileTypes";

// The Typescript server only sees the masked content of Yaml files (see `maskYamlFilesForTypescriptServer`).
// Formatting edits are computed for the masked content and would therefore remove the Yaml content outside of scripts.
export function overrideFormatting(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
) {
    proxy.getFormattingEditsForDocument = (fileName, options) =>
        isYamlFile(fileName)
            ? []
            : info.languageService.getFormattingEditsForDocument(
                  fileName,
                  options,
              );

    proxy.getFormattingEditsForRange = (fileName, start, end, options) =>
        isYamlFile(fileName)
            ? []
            : info.languageService.getFormattingEditsForRange(
                  fileName,
                  start,
                  end,
                  options,
              );

    proxy.getFormattingEditsAfterKeystroke = (
        fileName,
        position,
        key,
        options,
    ) =>
        isYamlFile(fileName)
            ? []
            : info.languageService.getFormattingEditsAfterKeystroke(
                  fileName,
                  position,
                  key,
                  options,
              );
}
