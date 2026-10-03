import { Range } from "@global_shared";
import {
    Diagnostic,
    DiagnosticSeverity,
    DiagnosticTag,
} from "vscode-languageserver";

/**
 * Marks disabled items of a sequence as unnecessary (similar to unused code in TypeScript).
 * Disabling an item is intentional, so this is only a hint that does not show up as a problem.
 */
export function getDiagnosticsForDisabledItems(
    disabledItems: { valueRange: Range }[],
): Diagnostic[] {
    return disabledItems.map(({ valueRange }) => ({
        message: "This item is disabled and has no effect.",
        range: valueRange,
        severity: DiagnosticSeverity.Hint,
        tags: [DiagnosticTag.Unnecessary],
    }));
}
