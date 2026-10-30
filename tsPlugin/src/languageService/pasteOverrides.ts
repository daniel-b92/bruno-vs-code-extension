import * as ts from "typescript/lib/tsserverlibrary";
import { hasEmbeddedCodeBlocks } from "../fileTypes";

// For computing edits when pasting (e.g. imports for the pasted code), the Typescript server temporarily replaces the content of the target file
// with its masked content (see `maskFilesWithCodeBlocksForTypescriptServer`) plus the pasted text and restores the masked content afterwards.
// The Typescript server would then keep the masked content as the content of the file, so that all features would fail for it until the file is reopened.
// Code copied from `.bru` and Yaml files would be handled like the wrapper functions of its code blocks.
export function overridePasting(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
) {
    proxy.preparePasteEditsForFile = (fileName, copiedTextRange) =>
        !hasEmbeddedCodeBlocks(fileName) &&
        info.languageService.preparePasteEditsForFile(
            fileName,
            copiedTextRange,
        );

    proxy.getPasteEdits = (args, formatOptions) =>
        hasEmbeddedCodeBlocks(args.targetFile) ||
        (args.copiedFrom && hasEmbeddedCodeBlocks(args.copiedFrom.file))
            ? { edits: [] }
            : info.languageService.getPasteEdits(args, formatOptions);
}
