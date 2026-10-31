import * as ts from "typescript/lib/tsserverlibrary";
import {
    adjustIndentationOfChangesForYamlScripts,
    createCheckForChangesWithinCodeBlocks,
    getFormatOptionsForFile,
} from "../codeChanges/codeChanges";
import { hasEmbeddedCodeBlocks } from "../fileTypes";

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

        const formatOptionsForFile = getFormatOptionsForFile(
            info,
            fileName,
            formatOptions,
        );

        return info.languageService
            .getCodeFixesAtPosition(
                fileName,
                start,
                end,
                errorCodes,
                formatOptionsForFile,
                preferences,
            )
            .map((fix) => ({
                ...fix,
                changes: adjustIndentationOfChangesForYamlScripts(
                    info,
                    fileName,
                    formatOptionsForFile,
                    { start, end },
                    fix.changes,
                ),
            }))
            .filter(
                ({ fixName, changes }) =>
                    // Code blocks used to be handled as Typescript code, so there were no quick fixes for suppressing errors via comments.
                    !(
                        hasEmbeddedCodeBlocks(fileName) &&
                        fixName == "disableJsDiagnostics"
                    ) && areAllChangesWithinCodeBlocks(changes),
            );
    };

    proxy.getCombinedCodeFix = (scope, fixId, formatOptions, preferences) => {
        const formatOptionsForFile = getFormatOptionsForFile(
            info,
            scope.fileName,
            formatOptions,
        );
        const combinedFix = info.languageService.getCombinedCodeFix(
            scope,
            fixId,
            formatOptionsForFile,
            preferences,
        );
        const adjustedFix = {
            ...combinedFix,
            changes: adjustIndentationOfChangesForYamlScripts(
                info,
                scope.fileName,
                formatOptionsForFile,
                { start: 0, end: Number.MAX_SAFE_INTEGER },
                combinedFix.changes,
            ),
        };

        // Only applying some of the changes could result in invalid code.
        return createCheckForChangesWithinCodeBlocks(info)(adjustedFix.changes)
            ? adjustedFix
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
        const formatOptionsForFile = getFormatOptionsForFile(
            info,
            fileName,
            formatOptions,
        );
        const refactorEdits = info.languageService.getEditsForRefactor(
            fileName,
            formatOptionsForFile,
            positionOrRange,
            refactorName,
            actionName,
            preferences,
            interactiveRefactorArguments,
        );
        const adjustedEdits = refactorEdits && {
            ...refactorEdits,
            edits: adjustIndentationOfChangesForYamlScripts(
                info,
                fileName,
                formatOptionsForFile,
                typeof positionOrRange == "number"
                    ? { start: positionOrRange, end: positionOrRange }
                    : {
                          start: positionOrRange.pos,
                          end: positionOrRange.end,
                      },
                refactorEdits.edits,
            ),
        };

        return adjustedEdits &&
            createCheckForChangesWithinCodeBlocks(info)(adjustedEdits.edits)
            ? adjustedEdits
            : undefined;
    };

    // Refactorings that cannot be applied within code blocks (e.g. 'Extract to function in global scope') would be listed, but yield no edits when selected.
    proxy.getApplicableRefactors = (
        fileName,
        positionOrRange,
        preferences,
        triggerReason,
        kind,
        includeInteractiveActions,
    ) => {
        const refactors = info.languageService.getApplicableRefactors(
            fileName,
            positionOrRange,
            preferences,
            triggerReason,
            kind,
            // Interactive actions (e.g. 'Move to file') need arguments that are only known once the user has chosen a target.
            // Typescript does not mark them via `isInteractive` and computing their edits without these arguments fails (which also pauses attached debuggers).
            includeInteractiveActions && !hasEmbeddedCodeBlocks(fileName),
        );

        if (!hasEmbeddedCodeBlocks(fileName)) {
            return refactors;
        }

        return refactors
            .map((refactor) => ({
                ...refactor,
                actions: refactor.actions.filter(
                    ({ name, notApplicableReason }) =>
                        // Actions that are not applicable are only shown as disabled (if requested via `provideRefactorNotApplicableReason`).
                        // The Typescript server fails when computing edits for them.
                        notApplicableReason != undefined ||
                        hasEditsWithinCodeBlocks(proxy, {
                            fileName,
                            positionOrRange,
                            refactorName: refactor.name,
                            actionName: name,
                            preferences,
                        }),
                ),
            }))
            .filter(({ actions }) => actions.length > 0);
    };
}

function hasEditsWithinCodeBlocks(
    proxy: ts.LanguageService,
    {
        fileName,
        positionOrRange,
        refactorName,
        actionName,
        preferences,
    }: {
        fileName: string;
        positionOrRange: number | ts.TextRange;
        refactorName: string;
        actionName: string;
        preferences: ts.UserPreferences | undefined;
    },
) {
    // A failure for a single action should not fail the whole request, since then no refactorings would be offered at all.
    try {
        return (
            proxy.getEditsForRefactor(
                fileName,
                ts.getDefaultFormatCodeSettings(),
                positionOrRange,
                refactorName,
                actionName,
                preferences,
            ) != undefined
        );
    } catch {
        return false;
    }
}
