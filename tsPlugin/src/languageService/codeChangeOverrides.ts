import * as ts from "typescript/lib/tsserverlibrary";
import {
    createCheckForChangesWithinCodeBlocks,
    getFormatOptionsForFile,
} from "../codeChanges/codeChanges";

// Some code fixes and refactorings insert code outside of code blocks (e.g. an import at the top of the file),
// which would corrupt the content of '.bru' and '.yml' files.
export function overrideCodeChanges(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
) {
    proxy.getCodeFixesAtPosition = (
        fileName,
        start,
        end,
        errorCodes,
        formatOptions,
        preferences,
    ) => {
        const areAllChangesWithinCodeBlocks =
            createCheckForChangesWithinCodeBlocks(info);

        return info.languageService
            .getCodeFixesAtPosition(
                fileName,
                start,
                end,
                errorCodes,
                getFormatOptionsForFile(info, fileName, formatOptions, {
                    start,
                    end,
                }),
                preferences,
            )
            .filter(({ changes }) => areAllChangesWithinCodeBlocks(changes));
    };

    proxy.getCombinedCodeFix = (scope, fixId, formatOptions, preferences) => {
        const combinedFix = info.languageService.getCombinedCodeFix(
            scope,
            fixId,
            getFormatOptionsForFile(info, scope.fileName, formatOptions, {
                start: 0,
                end: Number.MAX_SAFE_INTEGER,
            }),
            preferences,
        );

        // Only applying some of the changes could result in invalid code.
        return createCheckForChangesWithinCodeBlocks(info)(combinedFix.changes)
            ? combinedFix
            : { changes: [] };
    };

    proxy.getEditsForRefactor = (
        fileName,
        formatOptions,
        positionOrRange,
        refactorName,
        actionName,
        preferences,
        interactiveRefactorArguments,
    ) => {
        const refactorEdits = info.languageService.getEditsForRefactor(
            fileName,
            getFormatOptionsForFile(
                info,
                fileName,
                formatOptions,
                typeof positionOrRange == "number"
                    ? { start: positionOrRange, end: positionOrRange }
                    : {
                          start: positionOrRange.pos,
                          end: positionOrRange.end,
                      },
            ),
            positionOrRange,
            refactorName,
            actionName,
            preferences,
            interactiveRefactorArguments,
        );

        return refactorEdits &&
            createCheckForChangesWithinCodeBlocks(info)(refactorEdits.edits)
            ? refactorEdits
            : undefined;
    };
}
