import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { join } from "path";
import { workspace, WorkspaceEdit } from "vscode";
import { BrunoRequestFile, CollectionFormat } from "@global_shared";
import { createCollectionWithItems } from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { renameFileOrFolder } from "./renameFileOrFolder";

const root = join("/", "collection");
const callerPath = join(root, "caller.bru");
const callerContent = `script:pre-request {
  await bru.runRequest("users/a");
}
`;

describe("renameFileOrFolder", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renames the file together with the updates of run request paths and saves the edited files", async () => {
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        const save = jest.spyOn(workspace, "save");
        openDocuments(openDocument(callerPath, callerContent, false));

        const result = await renameFileOrFolder(
            createItemProvider(),
            join(root, "users/a.bru"),
            join(root, "users/b.bru"),
            true,
        );

        expect(result).toBe(true);
        expect(applyEdit).toHaveBeenCalledTimes(1);
        const [edit, metadata] = applyEdit.mock.calls[0];
        expect(metadata).toEqual({ isRefactoring: true });
        expect(
            (
                edit as WorkspaceEdit & {
                    renames: { to: { fsPath: string } }[];
                }
            ).renames.map(({ to }) => to.fsPath),
        ).toEqual([join(root, "users/b.bru")]);
        expect(
            (
                edit as WorkspaceEdit & {
                    replacements: {
                        uri: { fsPath: string };
                        newText: string;
                    }[];
                }
            ).replacements.map(({ uri, newText }) => [uri.fsPath, newText]),
        ).toEqual([[callerPath, "users/b"]]);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0][0]).toMatchObject({ fsPath: callerPath });
    });

    it("does not save documents that had unsaved changes", async () => {
        const save = jest.spyOn(workspace, "save");
        openDocuments(openDocument(callerPath, callerContent, true));

        await renameFileOrFolder(
            createItemProvider(),
            join(root, "users/a.bru"),
            join(root, "users/b.bru"),
            true,
        );

        expect(save).not.toHaveBeenCalled();
    });

    it("renames without updates if the rename with updates fails", async () => {
        openDocuments(openDocument(callerPath, callerContent, false));
        const applyEdit = jest
            .spyOn(workspace, "applyEdit")
            .mockResolvedValueOnce(false);

        const result = await renameFileOrFolder(
            createItemProvider(),
            join(root, "users/a.bru"),
            join(root, "users/b.bru"),
            true,
        );

        expect(result).toBe(true);
        expect(applyEdit).toHaveBeenCalledTimes(2);
        expect(
            (applyEdit.mock.calls[1][0] as WorkspaceEdit & { replacements: [] })
                .replacements,
        ).toEqual([]);
    });
});

function createItemProvider() {
    return createCollectionWithItems<TypedCollectionItemProvider>(
        [
            new BrunoRequestFile(join(root, "users/a.bru")),
            new BrunoRequestFile(callerPath),
        ],
        CollectionFormat.Bru,
        [],
        root,
    ).itemProvider;
}

function openDocument(path: string, content: string, isDirty: boolean) {
    return {
        fileName: path,
        eol: 1,
        uri: { fsPath: path },
        isDirty,
        getText: () => content,
    };
}

function openDocuments(...documents: ReturnType<typeof openDocument>[]) {
    jest.replaceProperty(workspace, "textDocuments", documents as never);
}
