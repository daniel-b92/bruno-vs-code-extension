import { access, readFile, rename, writeFile } from "fs/promises";
import { WorkspaceEdit } from "vscode";

type MockedWorkspaceEdit = WorkspaceEdit & {
    renames: {
        from: { fsPath: string };
        to: { fsPath: string };
        options?: { overwrite?: boolean };
    }[];
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
 * Like VS Code, it fails without applying anything if one of the targets of the renames exists already (unless overwriting is allowed),
 * even if the item at the target is renamed by an earlier rename of the same edit.
 * Not simulated: The unsaved changes of open files, which VS Code restores at wrong paths if a folder and an item within it are renamed by the same edit.
 * Otherwise the renames are applied in the given order, then the text replacements (single-line ranges only) to the files at their new locations.
 */
export async function applyWorkspaceEdit(edit: unknown) {
    const { renames, replacements } = edit as MockedWorkspaceEdit;

    for (const { to, options } of renames) {
        if (
            !options?.overwrite &&
            (await access(to.fsPath).then(
                () => true,
                () => false,
            ))
        ) {
            return false;
        }
    }

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
