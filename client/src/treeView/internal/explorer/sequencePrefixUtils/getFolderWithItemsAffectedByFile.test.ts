import { describe, expect, it } from "@jest/globals";
import { join } from "path";
import {
    BrunoFileType,
    CollectionFormat,
    getFolderSettingsFileName,
    ItemType,
    NonBrunoSpecificItemType,
} from "@global_shared";
import { createItemProviderStub } from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { getFolderWithItemsAffectedByFile } from "./getFolderWithItemsAffectedByFile";

describe.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
    "getFolderWithItemsAffectedByFile (%s)",
    (format) => {
        const root = "/collection";
        const settingsFile = getFolderSettingsFileName(format);

        it.each<[string, ItemType, string[], string | undefined]>([
            [
                "a request",
                BrunoFileType.RequestFile,
                ["a", "request"],
                join(root, "a"),
            ],
            [
                "an app file",
                BrunoFileType.AppFile,
                ["a", "app"],
                join(root, "a"),
            ],
            [
                "a folder settings file",
                BrunoFileType.FolderSettingsFile,
                ["a", "b", settingsFile],
                join(root, "a"),
            ],
            [
                "a request that is moved to the path of a folder settings file",
                BrunoFileType.RequestFile,
                ["a", settingsFile],
                root,
            ],
            [
                "a folder settings file that is moved into the collection root",
                BrunoFileType.FolderSettingsFile,
                [settingsFile],
                undefined,
            ],
            [
                "a copy of a folder settings file with another name",
                BrunoFileType.FolderSettingsFile,
                ["a", "copy"],
                undefined,
            ],
            [
                "a file in the environments folder",
                BrunoFileType.FolderSettingsFile,
                ["environments", settingsFile],
                undefined,
            ],
            [
                "another file",
                NonBrunoSpecificItemType.OtherFileType,
                ["a", "script.js"],
                undefined,
            ],
        ])("handles %s", (_, fileType, pathSegments, expected) => {
            expect(
                getFolderWithItemsAffectedByFile(
                    createItemProviderStub<TypedCollectionItemProvider>(
                        root,
                        format,
                    ),
                    join(root, ...pathSegments),
                    fileType,
                ),
            ).toBe(expected);
        });
    },
);
