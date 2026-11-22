import { CodeAction, CodeActionKind, Diagnostic } from "vscode-languageserver";
import { basename } from "path";
import { isSequencePrefixDiagnosticData } from "./getSequencePrefixDiagnostic";

/** The id of the client command that renames the item (and updates the paths of `bru.runRequest` calls). */
export const renameToMatchSequenceCommand =
    "bru-as-code.renameItemToMatchSequence";

/** The rename is executed by the client, so that the paths in `bru.runRequest` calls are updated as well. */
export function getSequencePrefixQuickFixes(
    diagnostics: Diagnostic[],
): CodeAction[] {
    return diagnostics.flatMap((diagnostic) => {
        const data = diagnostic.data;

        return isSequencePrefixDiagnosticData(data)
            ? [
                  {
                      title: `Rename to '${basename(data.targetPath)}' to match the sequence`,
                      kind: CodeActionKind.QuickFix,
                      diagnostics: [diagnostic],
                      command: {
                          title: "Rename to match the sequence",
                          command: renameToMatchSequenceCommand,
                          arguments: [
                              data.sourcePath,
                              data.targetPath,
                              data.isFile,
                          ],
                      },
                  },
              ]
            : [];
    });
}
