import { readFile, rename, writeFile } from "fs/promises";
import { WorkspaceEdit } from "vscode";

type MockedWorkspaceEdit = WorkspaceEdit & {
    renames: { from: { fsPath: string }; to: { fsPath: string } }[];
    replacements: {
        uri: { fsPath: string };
        range: {
            start: { line: number; character: number };
            end: { line: number; character: number };
        };
        newText: string;
    }[];
};

/**
 * The mocked `workspace.applyEdit` does not apply any edits. Use this as its implementation to apply the edit to the file system:
 * `jest.spyOn(workspace, "applyEdit").mockImplementation(applyWorkspaceEdit)`.
 *
 * The renames are applied in the given order, then the text replacements (single-line ranges only) to the files at their new locations.
 */
export async function applyWorkspaceEdit(edit: unknown) {
    const { renames, replacements } = edit as MockedWorkspaceEdit;

    for (const { from, to } of renames) {
        await rename(from.fsPath, to.fsPath);
    }

    for (const { uri, range, newText } of [...replacements].reverse()) {
        const lines = (await readFile(uri.fsPath, "utf-8")).split("\n");
        const { line } = range.start;

        lines[line] =
            lines[line].slice(0, range.start.character) +
            newText +
            lines[line].slice(range.end.character);
        await writeFile(uri.fsPath, lines.join("\n"));
    }

    return true;
}
