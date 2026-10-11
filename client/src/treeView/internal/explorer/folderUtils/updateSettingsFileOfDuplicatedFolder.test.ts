import { describe, it, expect } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { CollectionFormat } from "@global_shared";
import {
    createItemProviderStub,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { updateSettingsFileOfDuplicatedFolder } from "./updateSettingsFileOfDuplicatedFolder";

describe("updateSettingsFileOfDuplicatedFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

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
