import { describe, expect, it } from "@jest/globals";
import { join } from "path";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { resolveBruCliCommand } from "./resolveBruCliCommand";

describe("resolveBruCliCommand", () => {
    const createDirectory = useTemporaryDirectories();

    it("should use the configured absolute path if it exists", async () => {
        const root = await createDirectory({ "tools/mybru": "", "col/x": "" });
        const configuredPath = join(root, "tools", "mybru");

        expect(
            resolveBruCliCommand({
                configuredPath,
                collectionRootDirectory: join(root, "col"),
                workspaceFolderPath: root,
            }),
        ).toEqual({ source: "setting", command: configuredPath });
    });

    it("should resolve a configured relative path against the workspace folder", async () => {
        const root = await createDirectory({ "tools/mybru": "", "col/x": "" });

        expect(
            resolveBruCliCommand({
                configuredPath: "tools/mybru",
                collectionRootDirectory: join(root, "col"),
                workspaceFolderPath: root,
            }),
        ).toEqual({ source: "setting", command: join(root, "tools", "mybru") });
    });

    it("should not fall back if the configured path does not exist", async () => {
        const root = await createDirectory({ "node_modules/.bin/bru": "" });

        expect(
            resolveBruCliCommand({
                configuredPath: "missing",
                collectionRootDirectory: root,
                workspaceFolderPath: root,
            }),
        ).toEqual({ source: "invalidSetting", configuredPath: "missing" });
    });

    it("should not accept a configured path that is a directory", async () => {
        const root = await createDirectory({ "tools/x": "" });

        expect(
            resolveBruCliCommand({
                configuredPath: "tools",
                collectionRootDirectory: root,
                workspaceFolderPath: root,
            }),
        ).toEqual({ source: "invalidSetting", configuredPath: "tools" });
    });

    it("should find a local install in the collection root directory", async () => {
        const root = await createDirectory({ "col/node_modules/.bin/bru": "" });
        const collection = join(root, "col");

        expect(
            resolveBruCliCommand({
                collectionRootDirectory: collection,
                workspaceFolderPath: root,
                platform: "linux",
            }),
        ).toEqual({
            source: "localInstall",
            command: join(collection, "node_modules", ".bin", "bru"),
        });
    });

    it("should find a local install in a parent directory", async () => {
        const root = await createDirectory({
            "node_modules/.bin/bru": "",
            "a/col/x": "",
        });

        expect(
            resolveBruCliCommand({
                collectionRootDirectory: join(root, "a", "col"),
                workspaceFolderPath: root,
                platform: "linux",
            }),
        ).toEqual({
            source: "localInstall",
            command: join(root, "node_modules", ".bin", "bru"),
        });
    });

    it("should ignore local installs above the workspace folder", async () => {
        const root = await createDirectory({
            "node_modules/.bin/bru": "",
            "ws/col/x": "",
        });

        expect(
            resolveBruCliCommand({
                collectionRootDirectory: join(root, "ws", "col"),
                workspaceFolderPath: join(root, "ws"),
                platform: "linux",
            }),
        ).toEqual({ source: "global", command: "bru" });
    });

    it("should use the '.cmd' variant on Windows", async () => {
        const root = await createDirectory({ "node_modules/.bin/bru.cmd": "" });

        expect(
            resolveBruCliCommand({
                collectionRootDirectory: root,
                workspaceFolderPath: root,
                platform: "win32",
            }),
        ).toEqual({
            source: "localInstall",
            command: join(root, "node_modules", ".bin", "bru.cmd"),
        });
    });

    it("should fall back to the global CLI without a local install", async () => {
        const root = await createDirectory({ "col/x": "" });

        expect(
            resolveBruCliCommand({
                collectionRootDirectory: join(root, "col"),
                workspaceFolderPath: root,
            }),
        ).toEqual({ source: "global", command: "bru" });
    });
});
