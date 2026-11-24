import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { workspace } from "vscode";
import {
    BrunoFileType,
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
import { moveFileIntoFolder } from "./moveFileIntoFolder";

describe("moveFileIntoFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([
        [true, ["0010_y.bru", "0020_x.bru"], "b/0020_x"],
        [false, ["0010_x.bru", "0010_y.bru"], "b/0010_x"],
    ])(
        "keeps the name in sync with the new sequence of the moved request if names are prefixed with sequences (%s)",
        async (prefixNames, expectedNames, expectedCall) => {
            mockVsCodeSettings({
                "bru-as-code.prefixNamesWithSequence": prefixNames,
                "bru-as-code.sequenceStep": 10,
            });
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );
            const directory = await createTemporaryDirectory({
                "caller.bru": `${requestContent("caller")}\nscript:pre-request {\n  await bru.runRequest("a/0010_x");\n}\n`,
                "a/0010_x.bru": requestContent("x", 10),
                "b/0010_y.bru": requestContent("y", 10),
            });
            const itemProvider =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [
                        new BrunoRequestFile(join(directory, "caller.bru")),
                        new CollectionDirectory(join(directory, "a")),
                        new CollectionDirectory(join(directory, "b")),
                        new BrunoRequestFile(
                            join(directory, "a", "0010_x.bru"),
                            10,
                        ),
                        new BrunoRequestFile(
                            join(directory, "b", "0010_y.bru"),
                            10,
                        ),
                    ],
                    CollectionFormat.Bru,
                    [],
                    directory,
                ).itemProvider;

            await moveFileIntoFolder(
                itemProvider,
                join(directory, "a", "0010_x.bru"),
                join(directory, "b", "0010_x.bru"),
                new BrunoTreeItem(join(directory, "b"), false, false),
                join(directory, "b"),
                BrunoFileType.RequestFile,
            );

            expect(await readdir(join(directory, "a"))).toEqual([]);
            expect((await readdir(join(directory, "b"))).sort()).toEqual(
                expectedNames,
            );
            // The path in the call refers to the final location of the request.
            expect(
                await readFile(join(directory, "caller.bru"), "utf-8"),
            ).toContain(`runRequest("${expectedCall}")`);
        },
    );
});

function requestContent(name: string, sequence?: number) {
    return `meta {\n  name: ${name}\n  type: http\n${sequence === undefined ? "" : `  seq: ${sequence}\n`}}\n`;
}
