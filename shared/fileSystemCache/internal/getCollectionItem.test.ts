import { describe, it, expect, afterEach } from "@jest/globals";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
    BrunoEnvironmentFile,
    BrunoFileType,
    NonBrunoFile,
    NonBrunoSpecificItemType,
} from "../..";
import { getCollectionItemForFile } from "./getCollectionItem";

describe("getCollectionItemForFile", () => {
    let tempDir: string | undefined;

    afterEach(async () => {
        if (tempDir != undefined) {
            await rm(tempDir, { recursive: true, force: true });
            tempDir = undefined;
        }
    });

    async function createEnvironmentFile(content: string) {
        tempDir = await mkdtemp(join(tmpdir(), "bru-env-"));
        const filePath = join(tempDir, "Test.bru");
        await writeFile(filePath, content, "utf-8");
        return filePath;
    }

    it("caches a valid top level 'extends' field", async () => {
        const filePath = await createEnvironmentFile(
            `extends: Base\n\nvars {\n  first: 1\n}`,
        );

        const result = (await getCollectionItemForFile(
            filePath,
            BrunoFileType.EnvironmentFile,
        )) as BrunoEnvironmentFile;

        expect(result.getExtends()).toBe("Base");
        expect(result.getVariables()).toEqual([
            expect.objectContaining({ key: "first", value: "1" }),
        ]);
    });

    it("does not cache an 'extends' field when it is defined multiple times", async () => {
        const filePath = await createEnvironmentFile(
            `extends: Base\nextends: Other\n\nvars {\n  first: 1\n}`,
        );

        const result = (await getCollectionItemForFile(
            filePath,
            BrunoFileType.EnvironmentFile,
        )) as BrunoEnvironmentFile;

        expect(result.getExtends()).toBeUndefined();
    });

    it("caches no 'extends' field when none is present", async () => {
        const filePath = await createEnvironmentFile(`vars {\n  first: 1\n}`);

        const result = (await getCollectionItemForFile(
            filePath,
            BrunoFileType.EnvironmentFile,
        )) as BrunoEnvironmentFile;

        expect(result.getExtends()).toBeUndefined();
    });
    it("returns a NonBrunoFile for OtherFileType", async () => {
        const result = await getCollectionItemForFile(
            "/some/path/script.js",
            NonBrunoSpecificItemType.OtherFileType,
        );

        expect(result).toBeInstanceOf(NonBrunoFile);
        expect(result?.getPath()).toBe("/some/path/script.js");
        expect(result?.getItemType()).toBe(
            NonBrunoSpecificItemType.OtherFileType,
        );
    });

    it("returns undefined for an unknown item type", async () => {
        const result = await getCollectionItemForFile(
            "/some/path/unknown",
            "unknown" as BrunoFileType,
        );

        expect(result).toBeUndefined();
    });
});
