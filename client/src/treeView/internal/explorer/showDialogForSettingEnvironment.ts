import {
    getExtensionForBrunoFiles,
    ConfiguredEnvironmentPerCollectionSetting,
    isTestEnvironmentsSettingValid,
    getEnvironmentSettingsKey,
} from "@global_shared";
import { DialogOptionLabelEnum, TypedCollection } from "@shared";
import { basename } from "path";
import { QuickPickItem, window, workspace } from "vscode";

export async function showDialogForSettingEnvironment(
    collection: TypedCollection,
    configuredEnvironmentName?: string,
) {
    const environments = collection.getEnvironments(configuredEnvironmentName);
    const options: QuickPickItem[] = environments.map(({ item, selected }) => ({
        label: basename(item.getPath(), getExtensionForBrunoFiles()),
        detail: selected ? "Selected" : undefined,
    }));

    const selected = await window.showQuickPick(options, {
        title: `Environment for collection '${basename(collection.getRootDirectory())}'`,
    });

    if (!selected) {
        return;
    }

    await updateSettings(collection, selected.label);
}

async function updateSettings(
    collection: TypedCollection,
    selectedEnvironmentName: string,
) {
    const sectionKey = getEnvironmentSettingsKey();

    // For non-defined object settings, VS Code seems to not return `undefined` when attempting ŧo get the setting.
    // Instead, it already initializes the object as `{}`.
    const oldConfigs = [JSON.stringify({}), JSON.stringify(undefined)].includes(
        JSON.stringify(workspace.getConfiguration().get(sectionKey)),
    )
        ? undefined
        : workspace.getConfiguration().get(sectionKey);

    const newCollectionConfig = {
        collectionRoot: collection.getRootDirectory(),
        environmentName: selectedEnvironmentName,
    };

    if (
        oldConfigs != undefined &&
        !isTestEnvironmentsSettingValid(oldConfigs)
    ) {
        const confirmationOption = DialogOptionLabelEnum.Confirm;

        const pickedOption = await window.showWarningMessage(
            "Parsing settings failed",
            {
                modal: true,
                detail: `Existing settings for test environments for section key '${sectionKey}' could not be parsed. Overwrite all existing entries with new setting?`,
            },
            confirmationOption,
        );

        if (pickedOption == confirmationOption) {
            overwriteExistingSettings(newCollectionConfig);
        }
        return;
    }

    const newConfigs: ConfiguredEnvironmentPerCollectionSetting =
        oldConfigs == undefined || oldConfigs.perCollection == undefined
            ? { perCollection: [newCollectionConfig] }
            : oldConfigs.perCollection.some(({ collectionRoot: existing }) =>
                    collection.isRootDirectory(existing),
                )
              ? {
                    perCollection: oldConfigs.perCollection.map((oldConfig) =>
                        collection.isRootDirectory(oldConfig.collectionRoot)
                            ? newCollectionConfig
                            : oldConfig,
                    ),
                }
              : {
                    perCollection:
                        oldConfigs.perCollection.concat(newCollectionConfig),
                };

    workspace.getConfiguration().update(sectionKey, newConfigs, true);
}

function overwriteExistingSettings(newCollectionConfig: {
    collectionRoot: string;
    environmentName: string;
}) {
    const sectionKey = getEnvironmentSettingsKey();
    workspace.getConfiguration().update(sectionKey, undefined, true);

    const newConfigs: ConfiguredEnvironmentPerCollectionSetting = {
        perCollection: [newCollectionConfig],
    };
    workspace.getConfiguration().update(sectionKey, newConfigs, true);
}
