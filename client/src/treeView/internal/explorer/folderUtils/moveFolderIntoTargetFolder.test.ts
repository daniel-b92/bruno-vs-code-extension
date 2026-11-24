import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { workspace } from "vscode";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
} from "@global_shared";
import {
    createCollectionWithItems,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import {
    applyWorkspaceEdit,
    mockVsCodeSettings,
} from "../../../../_testingUtils";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { moveFolderIntoTargetFolder } from "./moveFolderIntoTargetFolder";

describe("moveFolderIntoTargetFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("keeps the name of the moved folder in sync with its new sequence and updates the paths of requests within it", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 10,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "a/0010_users/folder.bru": folderSettings("users", 10),
            "a/0010_users/0010_get.bru": requestContent(
                "get",
                10,
                "a/0010_users/0020_other",
            ),
            "a/0010_users/0020_other.bru": requestContent("other", 20),
            "b/0010_existing/folder.bru": folderSettings("existing", 10),
        });
        const itemProvider =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(join(directory, "a")),
                    new CollectionDirectory(join(directory, "b")),
                    new CollectionDirectory(
                        join(directory, "a", "0010_users"),
                        join(directory, "a", "0010_users", "folder.bru"),
                        10,
                    ),
                    new BrunoRequestFile(
                        join(directory, "a", "0010_users", "0010_get.bru"),
                        10,
                    ),
                    new BrunoRequestFile(
                        join(directory, "a", "0010_users", "0020_other.bru"),
                        20,
                    ),
                    new CollectionDirectory(
                        join(directory, "b", "0010_existing"),
                        join(directory, "b", "0010_existing", "folder.bru"),
                        10,
                    ),
                ],
                CollectionFormat.Bru,
                [],
                directory,
            ).itemProvider;

        await moveFolderIntoTargetFolder(
            itemProvider,
            join(directory, "a", "0010_users"),
            new BrunoTreeItem(join(directory, "b"), false, false),
            FolderDropInsertionOption.MoveIntoTargetAsSubfolder,
            10,
        );

        expect(await readdir(join(directory, "a"))).toEqual([]);
        expect((await readdir(join(directory, "b"))).sort()).toEqual([
            "0010_existing",
            "0020_users",
        ]);
        expect(
            await readFile(
                join(directory, "b", "0020_users", "folder.bru"),
                "utf-8",
            ),
        ).toContain("seq: 20");
        // The request within the moved folder was found by its new location and refers to the final locations.
        expect(
            await readFile(
                join(directory, "b", "0020_users", "0010_get.bru"),
                "utf-8",
            ),
        ).toContain('runRequest("b/0020_users/0020_other")');
    });
});

function folderSettings(name: string, sequence: number) {
    return `meta {\n  name: ${name}\n  seq: ${sequence}\n}\n`;
}

function requestContent(name: string, sequence: number, calledPath?: string) {
    return `meta {\n  name: ${name}\n  type: http\n  seq: ${sequence}\n}\n${calledPath === undefined ? "" : `\nscript:pre-request {\n  await bru.runRequest("${calledPath}");\n}\n`}`;
}
