import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { CollectionFormat } from "@global_shared";
import {
    createItemProviderStub,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { mockVsCodeSettings } from "../../../../_testingUtils";
import { updateSettingsFileOfDuplicatedFolder } from "./updateSettingsFileOfDuplicatedFolder";

describe("updateSettingsFileOfDuplicatedFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("updates name and sequence for a duplicated bru folder with a sequence", async () => {
        const root = await createTemporaryDirectory({
            "first/folder.bru": getBruFolderSettings("first", 1),
            "second/folder.bru": getBruFolderSettings("second", 2),
            "second_copy/folder.bru": getBruFolderSettings("second", 2),
        });

        await updateSettingsFileOfDuplicatedFolder(
            createItemProviderStub<TypedCollectionItemProvider>(
                root,
                CollectionFormat.Bru,
            ),
            join(root, "second"),
            join(root, "second_copy"),
        );

        expect(
            await readFile(join(root, "second_copy/folder.bru"), "utf-8"),
        ).toBe(getBruFolderSettings("second_copy", 3));
    });

    it("updates the sequence for a duplicated folder with the sequence 0", async () => {
        const root = await createTemporaryDirectory({
            "first/folder.bru": getBruFolderSettings("first", 1),
            "zeroth/folder.bru": getBruFolderSettings("zeroth", 0),
            "zeroth_copy/folder.bru": getBruFolderSettings("zeroth", 0),
        });

        await updateSettingsFileOfDuplicatedFolder(
            createItemProviderStub<TypedCollectionItemProvider>(
                root,
                CollectionFormat.Bru,
            ),
            join(root, "zeroth"),
            join(root, "zeroth_copy"),
        );

        expect(
            await readFile(join(root, "zeroth_copy/folder.bru"), "utf-8"),
        ).toBe(getBruFolderSettings("zeroth_copy", 2));
    });

    it("updates name and sequence for a duplicated yaml folder with a sequence", async () => {
        const root = await createTemporaryDirectory({
            "first/folder.yml": getYamlFolderSettings("first", 1),
            "first_copy/folder.yml": getYamlFolderSettings("first", 1),
        });

        await updateSettingsFileOfDuplicatedFolder(
            createItemProviderStub<TypedCollectionItemProvider>(
                root,
                CollectionFormat.Yaml,
            ),
            join(root, "first"),
            join(root, "first_copy"),
        );

        expect(
            await readFile(join(root, "first_copy/folder.yml"), "utf-8"),
        ).toBe(getYamlFolderSettings("first_copy", 2));
    });

    it("stores the name without the sequence prefix if names are prefixed with sequences", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 1,
        });
        const root = await createTemporaryDirectory({
            "002_second/folder.bru": getBruFolderSettings("second", 2),
            "002_second_Copy/folder.bru": getBruFolderSettings("second", 2),
        });

        await updateSettingsFileOfDuplicatedFolder(
            createItemProviderStub<TypedCollectionItemProvider>(
                root,
                CollectionFormat.Bru,
            ),
            join(root, "002_second"),
            join(root, "002_second_Copy"),
        );

        expect(
            await readFile(join(root, "002_second_Copy/folder.bru"), "utf-8"),
        ).toBe(getBruFolderSettings("second_Copy", 3));
    });

    it("updates only the name for a duplicated bru folder without a sequence", async () => {
        const root = await createTemporaryDirectory({
            "first/folder.bru": getBruFolderSettings("first"),
            "first_copy/folder.bru": getBruFolderSettings("first"),
        });

        await updateSettingsFileOfDuplicatedFolder(
            createItemProviderStub<TypedCollectionItemProvider>(
                root,
                CollectionFormat.Bru,
            ),
            join(root, "first"),
            join(root, "first_copy"),
        );

        expect(
            await readFile(join(root, "first_copy/folder.bru"), "utf-8"),
        ).toBe(getBruFolderSettings("first_copy"));
    });

    it("updates only the name for a duplicated yaml folder without a sequence", async () => {
        const root = await createTemporaryDirectory({
            "first/folder.yml": getYamlFolderSettings("first"),
            "first_copy/folder.yml": getYamlFolderSettings("first"),
        });

        await updateSettingsFileOfDuplicatedFolder(
            createItemProviderStub<TypedCollectionItemProvider>(
                root,
                CollectionFormat.Yaml,
            ),
            join(root, "first"),
            join(root, "first_copy"),
        );

        expect(
            await readFile(join(root, "first_copy/folder.yml"), "utf-8"),
        ).toBe(getYamlFolderSettings("first_copy"));
    });
});

function getBruFolderSettings(name: string, sequence?: number) {
    return [
        "meta {",
        `  name: ${name}`,
        ...(sequence === undefined ? [] : [`  seq: ${sequence}`]),
        "}",
        "",
    ].join("\n");
}

function getYamlFolderSettings(name: string, sequence?: number) {
    return [
        "info:",
        `  name: ${name}`,
        "  type: folder",
        ...(sequence === undefined ? [] : [`  seq: ${sequence}`]),
        "",
    ].join("\n");
}
