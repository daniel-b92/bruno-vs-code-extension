import { getExtensionForBrunoFiles } from "@global_shared";
import { TypedCollection } from "@shared";
import { basename } from "path";
import { QuickPickItem, window, workspace } from "vscode";

interface configuredEnvironmentPerCollectionSetting {
    perCollection: {
        collectionRootFolder: string;
        selectedEnvironmentName?: string;
    }[];
}

export async function showDialogForSettingEnvironment(
    collection: TypedCollection,
    configuredEnvironmentName?: string,
) {
    const environments = collection.getEnvironments(configuredEnvironmentName);
    const options: QuickPickItem[] = environments.map(({ item, selected }) => ({
        label: basename(item.getPath(), getExtensionForBrunoFiles()),
        picked: selected,
    }));

    const selected = await window.showQuickPick(options, {
        ignoreFocusOut: true,
        title: `Environment for collection '${basename(collection.getRootDirectory())}'`,
    });

    if (!selected) {
        return;
    }

    updateSettings(collection, selected.label);
}

function updateSettings(
    collection: TypedCollection,
    selectedEnvironmentName: string,
) {
    const sectionKey = "bru-as-code.testRunEnvironmentsPerCollection";

    const oldConfigs = workspace
        .getConfiguration()
        .get<configuredEnvironmentPerCollectionSetting>(sectionKey);

    const newCollectionConfig = {
        collectionRootFolder: collection.getRootDirectory(),
        selectedEnvironmentName,
    };

    const newConfigs: configuredEnvironmentPerCollectionSetting =
        oldConfigs == undefined
            ? { perCollection: [newCollectionConfig] }
            : {
                  perCollection: oldConfigs.perCollection.map((oldConfig) =>
                      collection.isRootDirectory(oldConfig.collectionRootFolder)
                          ? newCollectionConfig
                          : oldConfig,
                  ),
              };

    workspace.getConfiguration().update(sectionKey, newConfigs);
}
