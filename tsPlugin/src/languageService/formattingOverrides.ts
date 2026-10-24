import * as ts from "typescript/lib/tsserverlibrary";
import { hasEmbeddedCodeBlocks } from "../fileTypes";

// The Typescript server only sees the masked content of `.bru` and Yaml files (see `maskFilesWithCodeBlocksForTypescriptServer`).
// Formatting edits are computed for the masked content and would therefore remove the content outside of code blocks.
export function overrideFormatting(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
) {
    proxy.getFormattingEditsForDocument = (fileName, options) =>
        hasEmbeddedCodeBlocks(fileName)
            ? []
            : info.languageService.getFormattingEditsForDocument(
                  fileName,
                  options,
              );

    proxy.getFormattingEditsForRange = (fileName, start, end, options) =>
        hasEmbeddedCodeBlocks(fileName)
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
        hasEmbeddedCodeBlocks(fileName)
            ? []
            : info.languageService.getFormattingEditsAfterKeystroke(
                  fileName,
                  position,
                  key,
                  options,
              );
}
