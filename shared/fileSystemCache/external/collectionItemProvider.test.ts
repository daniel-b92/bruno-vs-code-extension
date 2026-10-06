import { describe, it, expect, afterEach } from "@jest/globals";
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
    NonBrunoSpecificItemType,
} from "../..";
import { useTemporaryDirectories } from "../../_testingUtils";

describe("CollectionItemProvider.refreshCache", () => {
    const createTemporaryDirectory = useTemporaryDirectories();
    const disposables: { dispose: () => void }[] = [];

    afterEach(() => {
        disposables.splice(0).forEach((disposable) => disposable.dispose());
    });

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

    function createProvider(workspace: string, featureToggles: FeatureToggles) {
        const collectionWatcher = new CollectionWatcher(
            Evt.create<FileChangedEvent>(),
            [workspace],
        );
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
