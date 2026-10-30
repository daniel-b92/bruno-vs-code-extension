import { describe, it, expect, afterEach, jest } from "@jest/globals";
import { writeFile } from "fs/promises";
import { Evt } from "evt";
import { basename, join } from "path";
import {
    AdditionalCollectionDataProviderType,
    BrunoAppFile,
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
    Logger,
    NonBrunoSpecificItemType,
    normalizePath,
} from "../..";
import { useTemporaryDirectories, waitUntil } from "../../_testingUtils";

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

        await provider.refreshCache();

        expect(getRegisteredCollectionNames(provider)).toEqual([
            "bruCollection (Bru)",
        ]);
    });

    it("also registers yaml collections with their items when the yaml toggle is on", async () => {
        const workspace = await createWorkspace();
        const provider = createProvider(workspace, {
            yamlCollectionSupport: true,
        });

        await provider.refreshCache();

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

describe("CollectionItemProvider.ensureCacheIsLoaded", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("does not load anything before it is called", async () => {
        const workspace = await createWorkspace();
        const { provider, getNumberOfLoads } =
            createProviderWithLoadCounter(workspace);

        expect(provider.getRegisteredCollections()).toHaveLength(0);
        expect(getNumberOfLoads()).toBe(0);
    });

    it("only loads the cache once for concurrent and later calls", async () => {
        const workspace = await createWorkspace();
        const { provider, getNumberOfLoads } =
            createProviderWithLoadCounter(workspace);

        const firstLoad = provider.ensureCacheIsLoaded();
        const secondLoad = provider.ensureCacheIsLoaded();
        expect(secondLoad).toBe(firstLoad);

        await Promise.all([firstLoad, secondLoad]);
        await provider.ensureCacheIsLoaded();

        expect(getNumberOfLoads()).toBe(1);
        expect(provider.getRegisteredCollections()).toHaveLength(1);
    });

    it("runs the initial load via the given wrapper", async () => {
        const workspace = await createWorkspace();
        let wrapperCalls = 0;
        const { provider } = createProviderWithLoadCounter(workspace, {
            runInitialCacheLoad: async (load) => {
                wrapperCalls++;
                await load();
            },
        });

        await provider.ensureCacheIsLoaded();
        await provider.refreshCache();

        expect(wrapperCalls).toBe(1);
    });

    it("lets the initial load be retried after it failed", async () => {
        const workspace = await createWorkspace();
        let shouldFail = true;
        const { provider } = createProviderWithLoadCounter(workspace, {
            runInitialCacheLoad: async (load) => {
                if (shouldFail) {
                    throw new Error("Loading failed");
                }
                await load();
            },
        });

        await expect(provider.ensureCacheIsLoaded()).rejects.toThrow(
            "Loading failed",
        );

        shouldFail = false;
        await provider.ensureCacheIsLoaded();

        expect(provider.getRegisteredCollections()).toHaveLength(1);
    });

    it("treats a refresh before the first lazy load as initial load", async () => {
        const workspace = await createWorkspace();
        const notifier = Evt.create<void>();
        let notifications = 0;
        notifier.attach(() => notifications++);
        const { provider, getNumberOfLoads } = createProviderWithLoadCounter(
            workspace,
            { cacheRefreshNotifier: notifier },
        );

        await Promise.all([
            provider.refreshCache(),
            provider.ensureCacheIsLoaded(),
        ]);

        expect(getNumberOfLoads()).toBe(1);
        expect(notifications).toBe(0);
    });

    it("waits for a running initial load before an explicit refresh starts", async () => {
        const workspace = await createWorkspace();
        const notifier = Evt.create<void>();
        let initialLoadFinished = false;
        let wasInitialLoadFinishedOnRefresh: boolean | undefined = undefined;
        notifier.attach(() => {
            wasInitialLoadFinishedOnRefresh = initialLoadFinished;
        });
        const { provider, getNumberOfLoads } = createProviderWithLoadCounter(
            workspace,
            { cacheRefreshNotifier: notifier },
        );

        const initialLoad = provider.ensureCacheIsLoaded().then(() => {
            initialLoadFinished = true;
        });
        await Promise.all([initialLoad, provider.refreshCache()]);

        expect(wasInitialLoadFinishedOnRefresh).toBe(true);
        expect(getNumberOfLoads()).toBe(2);
    });

    it("only notifies about cache refreshes that happen after the initial load", async () => {
        const workspace = await createWorkspace();
        const notifier = Evt.create<void>();
        let notifications = 0;
        notifier.attach(() => notifications++);
        const { provider } = createProviderWithLoadCounter(workspace, {
            cacheRefreshNotifier: notifier,
        });

        await provider.ensureCacheIsLoaded();
        expect(notifications).toBe(0);

        await provider.refreshCache();
        expect(notifications).toBe(1);
    });

    it("calls subscribers of the initial load once, without triggering the load", async () => {
        const workspace = await createWorkspace();
        const { provider, getNumberOfLoads } =
            createProviderWithLoadCounter(workspace);
        let calls = 0;
        let collectionsOnCall = 0;
        provider.subscribeToInitialCacheLoad(() => {
            calls++;
            collectionsOnCall = provider.getRegisteredCollections().length;
        });

        expect(calls).toBe(0);
        expect(getNumberOfLoads()).toBe(0);

        await provider.ensureCacheIsLoaded();
        await provider.refreshCache();

        expect(calls).toBe(1);
        expect(collectionsOnCall).toBe(1);
    });

    it("immediately calls subscribers of the initial load if it already finished", async () => {
        const workspace = await createWorkspace();
        const { provider } = createProviderWithLoadCounter(workspace);
        await provider.ensureCacheIsLoaded();

        let calls = 0;
        provider.subscribeToInitialCacheLoad(() => calls++);

        expect(calls).toBe(1);
    });

    async function createWorkspace() {
        return await createTemporaryDirectory({
            "bruCollection/bruno.json": "{}",
            "bruCollection/request.bru":
                "meta {\n  name: request\n  type: http\n  seq: 1\n}\n",
        });
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
        await provider.refreshCache();
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

    it("notifies subscribers only when the additional context roots of a collection actually change", async () => {
        const workspace = await createTemporaryDirectory({
            "collection/bruno.json": "{}",
            "collection/request.bru":
                "meta {\n  name: request\n  type: http\n  seq: 1\n}\n",
        });
        const rootFilePath = join(workspace, "collection", "bruno.json");
        const fileChangedEmitter = Evt.create<FileChangedEvent>();
        const provider = createProvider(
            workspace,
            { yamlCollectionSupport: true },
            fileChangedEmitter,
        );
        await provider.refreshCache();
        const callback = jest.fn();
        provider.subscribeToAdditionalContextRootChanges(callback);

        // Modification without a change of the context roots.
        await writeFile(rootFilePath, JSON.stringify({ name: "collection" }));
        fileChangedEmitter.post({
            path: rootFilePath,
            changeType: FileChangeType.Modified,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(callback).not.toHaveBeenCalled();

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

        await waitUntil(() => callback.mock.calls.length > 0);
        expect(callback).toHaveBeenCalledTimes(1);
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
        await provider.refreshCache();
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

    it("updates the cached sequence of a bru app file when it is modified", async () => {
        const workspace = await createTemporaryDirectory({
            "collection/bruno.json": "{}",
            "collection/request.bru":
                "meta {\n  name: request\n  type: http\n  seq: 1\n}\n",
            "collection/app.bru":
                "meta {\n  name: app\n  type: app\n  seq: 2\n}\n",
        });
        const fileChangedEmitter = Evt.create<FileChangedEvent>();
        const provider = createProvider(
            workspace,
            { yamlCollectionSupport: true },
            fileChangedEmitter,
        );
        await provider.refreshCache();
        const collection = provider.getRegisteredCollections()[0];
        const filePath = join(workspace, "collection/app.bru");
        const getSequence = () =>
            (
                collection.getStoredDataForPath(filePath)?.item as BrunoAppFile
            ).getSequence();

        expect(getSequence()).toBe(2);

        await writeFile(
            filePath,
            "meta {\n  name: app\n  type: app\n  seq: 5\n}\n",
        );
        fileChangedEmitter.post({
            path: filePath,
            changeType: FileChangeType.Modified,
        });

        await waitUntil(() => getSequence() == 5);
        expect(getSequence()).toBe(5);
    });

    it("recognizes a bru file as request file after it was edited from invalid to valid", async () => {
        await expectFileTypeChangeToBeHandled({
            files: {
                "collection/bruno.json": "{}",
                // A Bru collection is only recognized if it contains at least one valid request file.
                "collection/other.bru":
                    "meta {\n  name: other\n  type: http\n  seq: 2\n}\n",
                "collection/req.bru": "",
            },
            relativePath: "collection/req.bru",
            validContent: "meta {\n  name: req\n  type: http\n  seq: 1\n}\n",
        });
    });

    it("recognizes a yaml file as request file after it was edited from invalid to valid", async () => {
        await expectFileTypeChangeToBeHandled({
            files: {
                "collection/opencollection.yml":
                    "opencollection: 1.0.0\ninfo:\n  name: yaml\n",
                "collection/req.yml": "foo: bar\n",
            },
            relativePath: "collection/req.yml",
            validContent: "info:\n  name: req\n  type: http\n  seq: 1\n",
        });
    });

    async function expectFileTypeChangeToBeHandled(params: {
        files: Record<string, string>;
        relativePath: string;
        validContent: string;
    }) {
        const workspace = await createTemporaryDirectory(params.files);
        const fileChangedEmitter = Evt.create<FileChangedEvent>();
        const provider = createProvider(
            workspace,
            { yamlCollectionSupport: true },
            fileChangedEmitter,
        );
        await provider.refreshCache();
        const collection = provider.getRegisteredCollections()[0];
        const filePath = join(workspace, params.relativePath);
        const getRegisteredType = () =>
            collection.getStoredDataForPath(filePath)?.item.getItemType();

        expect(getRegisteredType()).toBe(
            NonBrunoSpecificItemType.OtherFileType,
        );

        const notifications: { path: string; updateType: FileChangeType }[] =
            [];
        provider.subscribeToUpdates((batch) =>
            batch.forEach(({ data: { item }, updateType }) =>
                notifications.push({ path: item.getPath(), updateType }),
            ),
        );

        await writeFile(filePath, params.validContent);
        fileChangedEmitter.post({
            path: filePath,
            changeType: FileChangeType.Modified,
        });
        await waitUntil(() => getRegisteredType() == BrunoFileType.RequestFile);

        expect(collection.getStoredDataForPath(filePath)?.item).toBeInstanceOf(
            BrunoRequestFile,
        );

        await waitUntil(() => notifications.length > 0);
        expect(notifications.map(({ updateType }) => updateType)).toContain(
            FileChangeType.Created,
        );
    }
});

describe("CollectionItemProvider: deletion of a collection root file", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("unregisters a bru collection when 'bruno.json' is deleted", async () => {
        await expectCollectionToBeUnregisteredOnRootFileDeletion({
            files: {
                "collection/bruno.json": "{}",
                "collection/request.bru":
                    "meta {\n  name: request\n  type: http\n  seq: 1\n}\n",
            },
            rootFileName: "bruno.json",
        });
    });

    it("unregisters a yaml collection when 'opencollection.yml' is deleted", async () => {
        await expectCollectionToBeUnregisteredOnRootFileDeletion({
            files: {
                "collection/opencollection.yml":
                    "opencollection: 1.0.0\ninfo:\n  name: yaml\n",
                "collection/request.yml":
                    "info:\n  name: request\n  type: http\n  seq: 1\n",
            },
            rootFileName: "opencollection.yml",
        });
    });

    async function expectCollectionToBeUnregisteredOnRootFileDeletion(params: {
        files: Record<string, string>;
        rootFileName: string;
    }) {
        const workspace = await createTemporaryDirectory(params.files);
        const fileChangedEmitter = Evt.create<FileChangedEvent>();
        const provider = createProvider(
            workspace,
            { yamlCollectionSupport: true },
            fileChangedEmitter,
        );
        await provider.refreshCache();

        expect(provider.getRegisteredCollections()).toHaveLength(1);

        const notifications: { path: string; updateType: FileChangeType }[] =
            [];
        provider.subscribeToUpdates((batch) =>
            batch.forEach(({ data: { item }, updateType }) =>
                notifications.push({ path: item.getPath(), updateType }),
            ),
        );

        fileChangedEmitter.post({
            path: join(workspace, "collection", params.rootFileName),
            changeType: FileChangeType.Deleted,
        });

        await waitUntil(() => provider.getRegisteredCollections().length == 0);
        expect(provider.getRegisteredCollections()).toHaveLength(0);

        await waitUntil(() => notifications.length > 0);
        expect(
            notifications.map(({ path, updateType }) => ({
                path: normalizePath(path),
                updateType,
            })),
        ).toEqual([
            {
                path: normalizePath(join(workspace, "collection")),
                updateType: FileChangeType.Deleted,
            },
        ]);
    }
});

describe("CollectionItemProvider: additional context roots", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("finds all collections sharing a context root, but not collections with a root that only has a common name prefix", async () => {
        const requestContent =
            "meta {\n  name: request\n  type: http\n  seq: 1\n}\n";
        const workspace = await createTemporaryDirectory({
            "colA/bruno.json": JSON.stringify({
                scripts: { additionalContextRoots: ["../shared"] },
            }),
            "colA/request.bru": requestContent,
            "colB/bruno.json": JSON.stringify({
                scripts: { additionalContextRoots: ["../shared"] },
            }),
            "colB/request.bru": requestContent,
            "colC/bruno.json": JSON.stringify({
                scripts: { additionalContextRoots: ["../shared-old"] },
            }),
            "colC/request.bru": requestContent,
            "shared/script.js": "",
            "shared-old/script.js": "",
        });
        const provider = createProvider(workspace, {
            yamlCollectionSupport: false,
        });
        await provider.refreshCache();

        const getRootNames = (path: string) =>
            provider
                .getCollectionsWithAdditionalContextRootContainingItem(path)
                .map((collection) => basename(collection.getRootDirectory()))
                .sort();

        expect(getRootNames(join(workspace, "shared", "script.js"))).toEqual([
            "colA",
            "colB",
        ]);
        expect(
            getRootNames(join(workspace, "shared-old", "script.js")),
        ).toEqual(["colC"]);
        expect(getRootNames(join(workspace, "other", "script.js"))).toEqual([]);
    });
});

function createProvider(
    workspace: string,
    featureToggles: FeatureToggles,
    fileChangedEmitter = Evt.create<FileChangedEvent>(),
    options?: {
        cacheRefreshNotifier?: Evt<void>;
        logger?: Logger;
        runInitialCacheLoad?: (load: () => Promise<void>) => Promise<void>;
    },
) {
    const collectionWatcher = new CollectionWatcher(fileChangedEmitter, [
        workspace,
    ]);
    const provider = new CollectionItemProvider<undefined>(
        collectionWatcher,
        [workspace],
        {
            paramType:
                AdditionalCollectionDataProviderType.SimpleCollectionItem,
            callback: () => undefined,
            isAdditionalDataOutdated: () => false,
        },
        [],
        featureToggles,
        options?.cacheRefreshNotifier,
        options?.logger,
        undefined,
        options?.runInitialCacheLoad,
    );
    disposables.push(provider, collectionWatcher);

    return provider;
}

/** A load is counted by the info log entry that the provider writes after finishing a scan of the file system. */
function createProviderWithLoadCounter(
    workspace: string,
    options?: {
        cacheRefreshNotifier?: Evt<void>;
        runInitialCacheLoad?: (load: () => Promise<void>) => Promise<void>;
    },
) {
    let numberOfLoads = 0;
    const logger: Logger = {
        trace: () => {},
        debug: () => {},
        info: (message) => {
            if (message.includes("Cache refresh duration")) {
                numberOfLoads++;
            }
        },
        warn: () => {},
        error: () => {},
        dispose: () => {},
    };

    return {
        provider: createProvider(
            workspace,
            { yamlCollectionSupport: false },
            undefined,
            { ...options, logger },
        ),
        getNumberOfLoads: () => numberOfLoads,
    };
}
