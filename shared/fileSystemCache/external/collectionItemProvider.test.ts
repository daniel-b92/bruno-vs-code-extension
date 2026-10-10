import { describe, it, expect, afterEach } from "@jest/globals";
import { writeFile } from "fs/promises";
import { Evt } from "evt";
import { basename, join } from "path";
import {
    AdditionalCollectionDataProviderType,
    BrunoEnvironmentFile,
    BrunoFileType,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    CollectionItemProvider,
    CollectionWatcher,
    FeatureToggles,
    FileChangedEvent,
    FileChangeType,
    NonBrunoSpecificItemType,
    normalizePath,
} from "../..";
import { useTemporaryDirectories } from "../../_testingUtils";

const disposables: { dispose: () => void }[] = [];

afterEach(() => {
    disposables.splice(0).forEach((disposable) => disposable.dispose());
});

describe("CollectionItemProvider.refreshCache", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("only registers bru collections when the yaml toggle is off", async () => {
        const workspace = await createWorkspace();
        const provider = createProvider(workspace, {
            yamlCollectionSupport: false,
        });

        await provider.refreshCache([workspace]);

        expect(getRegisteredCollectionNames(provider)).toEqual([
            "bruCollection (Bru)",
        ]);
    });

    it("also registers yaml collections with their items when the yaml toggle is on", async () => {
        const workspace = await createWorkspace();
        const provider = createProvider(workspace, {
            yamlCollectionSupport: true,
        });

        await provider.refreshCache([workspace]);

        expect(getRegisteredCollectionNames(provider)).toEqual([
            "bruCollection (Bru)",
            "yamlCollection (Yaml)",
        ]);

        const yamlRoot = join(workspace, "yamlCollection");
        const collection = provider
            .getRegisteredCollections()
            .find(
                (collection) =>
                    basename(collection.getRootDirectory()) == "yamlCollection",
            )!;
        const getItem = (relativePath: string) =>
            collection.getStoredDataForPath(join(yamlRoot, relativePath))?.item;

        expect(getItem("opencollection.yml")?.getItemType()).toBe(
            BrunoFileType.CollectionSettingsFile,
        );
        expect(getItem("Folder1")).toBeInstanceOf(CollectionDirectory);
        expect((getItem("Folder1") as CollectionDirectory).getSequence()).toBe(
            2,
        );
        expect(getItem("Folder1/folder.yml")?.getItemType()).toBe(
            BrunoFileType.FolderSettingsFile,
        );
        expect(getItem("Folder1/request.yml")).toBeInstanceOf(BrunoRequestFile);
        expect(
            (getItem("Folder1/request.yml") as BrunoRequestFile).getSequence(),
        ).toBe(1);
        expect(getItem("Folder1/app.yml")?.getItemType()).toBe(
            BrunoFileType.AppFile,
        );
        expect(getItem("environments/Dev.yml")).toBeInstanceOf(
            BrunoEnvironmentFile,
        );
        expect(getItem("notes.yml")?.getItemType()).toBe(
            NonBrunoSpecificItemType.OtherFileType,
        );
        expect(
            collection.getEnvironments().map((e) => e.environmentName),
        ).toEqual(["Dev"]);
    });

    async function createWorkspace() {
        return await createTemporaryDirectory({
            "bruCollection/bruno.json": "{}",
            "bruCollection/request.bru":
                "meta {\n  name: request\n  type: http\n  seq: 1\n}\n",
            "yamlCollection/opencollection.yml": "info:\n  name: yaml\n",
            "yamlCollection/Folder1/folder.yml":
                "info:\n  name: Folder1\n  type: folder\n  seq: 2\n",
            "yamlCollection/Folder1/request.yml":
                "info:\n  name: request\n  type: http\n  seq: 1\n",
            "yamlCollection/Folder1/app.yml":
                "info:\n  name: app\n  type: app\n  seq: 2\ncode: x\n",
            "yamlCollection/environments/Dev.yml": "name: Dev\nvariables: []\n",
            "yamlCollection/notes.yml": "foo: bar\n",
        });
    }

    function getRegisteredCollectionNames(
        provider: CollectionItemProvider<undefined>,
    ) {
        return provider
            .getRegisteredCollections()
            .map(
                (collection) =>
                    `${basename(collection.getRootDirectory())} (${collection.getFormat() as CollectionFormat})`,
            )
            .sort();
    }
});

describe("CollectionItemProvider: modification of a collection root file", () => {
    const createTemporaryDirectory = useTemporaryDirectories();
    it("updates the additional context roots when 'bruno.json' of a bru collection is modified", async () => {
        const workspace = await createTemporaryDirectory({
            "collection/bruno.json": "{}",
            "collection/request.bru":
                "meta {\n  name: request\n  type: http\n  seq: 1\n}\n",
        });
        const rootDir = join(workspace, "collection");
        const fileChangedEmitter = Evt.create<FileChangedEvent>();
        const provider = createProvider(
            workspace,
            { yamlCollectionSupport: true },
            fileChangedEmitter,
        );
        await provider.refreshCache([workspace]);
        const collection = provider.getRegisteredCollections()[0];

        expect(collection.getAdditionalContextRoots()).toEqual([]);

        const rootFilePath = join(rootDir, "bruno.json");
        await writeFile(
            rootFilePath,
            JSON.stringify({
                scripts: { additionalContextRoots: ["./shared"] },
            }),
        );
        fileChangedEmitter.post({
            path: rootFilePath,
            changeType: FileChangeType.Modified,
        });

        await waitUntil(
            () => collection.getAdditionalContextRoots().length > 0,
        );
        expect(collection.getAdditionalContextRoots()).toEqual([
            join(rootDir, "shared"),
        ]);
    });

    it("updates the additional context roots when 'opencollection.yml' of a yaml collection is modified", async () => {
        const workspace = await createTemporaryDirectory({
            "collection/opencollection.yml":
                "opencollection: 1.0.0\ninfo:\n  name: yaml\n",
            "collection/request.yml":
                "info:\n  name: request\n  type: http\n  seq: 1\n",
        });
        const rootDir = join(workspace, "collection");
        const fileChangedEmitter = Evt.create<FileChangedEvent>();
        const provider = createProvider(
            workspace,
            { yamlCollectionSupport: true },
            fileChangedEmitter,
        );
        await provider.refreshCache([workspace]);
        const collection = provider.getRegisteredCollections()[0];

        expect(collection.getFormat()).toBe(CollectionFormat.Yaml);
        expect(collection.getAdditionalContextRoots()).toEqual([]);

        const notifiedPaths: string[] = [];
        provider.subscribeToUpdates((notifications) =>
            notifications.forEach(({ data: { item } }) =>
                notifiedPaths.push(item.getPath()),
            ),
        );

        const rootFilePath = join(rootDir, "opencollection.yml");
        await writeFile(
            rootFilePath,
            [
                "opencollection: 1.0.0",
                "info:",
                "  name: yaml",
                "extensions:",
                "  bruno:",
                "    scripts:",
                "      additionalContextRoots:",
                '        - "./shared"',
                "",
            ].join("\n"),
        );
        fileChangedEmitter.post({
            path: rootFilePath,
            changeType: FileChangeType.Modified,
        });

        await waitUntil(
            () => collection.getAdditionalContextRoots().length > 0,
        );
        expect(collection.getAdditionalContextRoots()).toEqual([
            join(rootDir, "shared"),
        ]);

        // In the yaml format, the root file is also the collection settings file. So the root directory item gets updated, too.
        await waitUntil(() => notifiedPaths.length > 0);
        expect(notifiedPaths.map((path) => normalizePath(path))).toEqual([
            normalizePath(rootDir),
        ]);
    });

    async function waitUntil(condition: () => boolean, timeoutInMs = 3000) {
        const start = Date.now();

        while (!condition() && Date.now() - start < timeoutInMs) {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
    }
});

function createProvider(
    workspace: string,
    featureToggles: FeatureToggles,
    fileChangedEmitter = Evt.create<FileChangedEvent>(),
) {
    const collectionWatcher = new CollectionWatcher(fileChangedEmitter, [
        workspace,
    ]);
    const provider = new CollectionItemProvider<undefined>(
        collectionWatcher,
        {
            paramType:
                AdditionalCollectionDataProviderType.SimpleCollectionItem,
            callback: () => undefined,
            isAdditionalDataOutdated: () => false,
        },
        [],
        featureToggles,
    );
    disposables.push(provider, collectionWatcher);

    return provider;
}
