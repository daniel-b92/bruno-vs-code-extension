import { describe, it, expect } from "@jest/globals";
import {
    BrunoAppFile,
    BrunoCollectionSettingsFile,
    BrunoEnvironmentFile,
    BrunoFolderSettingsFile,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionItem,
    NonBrunoFile,
} from "@global_shared";
import { getIconForItem } from "./getIconForItem";

describe("getIconForItem", () => {
    it.each([
        [
            "request file",
            new BrunoRequestFile("/collection/request.bru"),
            "arrow-swap",
            "charts.blue",
        ],
        [
            "folder settings file",
            new BrunoFolderSettingsFile("/collection/folder/folder.bru"),
            "settings",
            "charts.orange",
        ],
        [
            "collection settings file",
            new BrunoCollectionSettingsFile("/collection/collection.bru"),
            "settings-gear",
            "charts.purple",
        ],
        [
            "environment file",
            new BrunoEnvironmentFile("/collection/environments/Test.bru", []),
            "variable-group",
            "charts.green",
        ],
        [
            "app file",
            new BrunoAppFile("/collection/app.bru"),
            "browser",
            "charts.yellow",
        ],
    ])("returns a colored icon for a %s", (_, item, iconId, colorId) => {
        const icon = getIconForItem(item, false);

        expect(icon?.id).toBe(iconId);
        expect(icon?.color?.id).toBe(colorId);
    });

    it("returns the collection settings icon for the root file that is not a `.bru` file", () => {
        const icon = getIconForItem(
            new NonBrunoFile("/collection/bruno.json"),
            true,
        );

        expect(icon).toBe(
            getIconForItem(
                new BrunoCollectionSettingsFile("/collection/collection.bru"),
                false,
            ),
        );
    });

    it.each([
        [
            "a file that is not a Bruno file",
            new NonBrunoFile("/collection/a.js"),
        ],
        [
            "a `bruno.json` file that is not the collection root file",
            new NonBrunoFile("/collection/sub/bruno.json"),
        ],
        ["a directory", new CollectionDirectory("/collection/folder")],
    ] as [string, CollectionItem][])(
        "returns no icon for %s, so that the icon theme is used",
        (_, item) => {
            expect(getIconForItem(item, false)).toBeUndefined();
        },
    );
});
