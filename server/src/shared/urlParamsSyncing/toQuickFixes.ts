import {
    CodeAction,
    CodeActionKind,
    Diagnostic,
    TextEdit,
} from "vscode-languageserver";

export interface FixDefinition {
    title: string;
    getEdits: () => TextEdit | TextEdit[];
}

/**
 * Maps the fix definitions for the given diagnostics to quick fix code actions.
 * Fixes without any edits are dropped. Fixes shared between diagnostics are only offered once.
 */
export function toQuickFixes(
    uri: string,
    diagnostics: Diagnostic[],
    getFixesForDiagnostic: (diagnostic: Diagnostic) => FixDefinition[],
): CodeAction[] {
    const actionsByTitle = new Map<string, CodeAction>();

    diagnostics.forEach((diagnostic) => {
        getFixesForDiagnostic(diagnostic).forEach(({ title, getEdits }) => {
            const existingAction = actionsByTitle.get(title);

            // Different diagnostics can share the same fix, which must only be offered once.
            if (existingAction) {
                existingAction.diagnostics?.push(diagnostic);
                return;
            }

            const edits = ([] as TextEdit[]).concat(getEdits());

            if (edits.length > 0) {
                actionsByTitle.set(title, {
                    title,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    edit: { changes: { [uri]: edits } },
                });
            }
        });
    });

    return Array.from(actionsByTitle.values());
}
