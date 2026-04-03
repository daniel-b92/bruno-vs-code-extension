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
    const environments = collection
        .getEnvironments()
        .map(({ item, environmentName }) => ({
            item,
            selected: configuredEnvironmentName === environmentName,
        }));

    const options: QuickPickItem[] = environments.map(({ item, selected }) => ({
        label: basename(item.getPath(), getExtensionForBrunoFiles()),
        description: selected ? "Selected" : undefined,
    }));

    const selectedOption = await window.showQuickPick(options, {
        title: `Environment for collection '${basename(collection.getRootDirectory())}'`,
    });

    if (!selectedOption) {
        return;
    }

    await updateSettings(collection, selectedOption.label);
}

async function updateSettings(
    collection: TypedCollection,
    selectedEnvironmentName: string,
) {
    const sectionKey = getEnvironmentSettingsKey();

    const newConfig = {
        [collection.getRootDirectory()]: selectedEnvironmentName,
    };

    // For non-defined object settings, VS Code seems to not return `undefined` when attempting ŧo get the setting.
    // Instead, it already initializes the object as `{}`.
    const oldConfigs = [JSON.stringify({}), JSON.stringify(undefined)].includes(
        JSON.stringify(workspace.getConfiguration().get(sectionKey)),
    )
        ? undefined
        : workspace.getConfiguration().get(sectionKey);

    if (
        oldConfigs != undefined &&
        !isTestEnvironmentsSettingValid(oldConfigs)
    ) {
        const confirmationOption = DialogOptionLabelEnum.Confirm;

        const pickedOption = await window.showWarningMessage(
            "Setting has invalid format",
            {
                modal: true,
                detail: `Existing setting for test environments could not be parsed. Overwrite all existing entries with new setting?`,
            },
            confirmationOption,
        );

        if (pickedOption == confirmationOption) {
            overwriteExistingSettings(newConfig);
        }
        return;
    }

    const newConfigs: ConfiguredEnvironmentPerCollectionSetting =
        oldConfigs == undefined
            ? { ...newConfig }
            : {
                  ...oldConfigs,
                  ...newConfig,
              };

    workspace.getConfiguration().update(sectionKey, newConfigs, true);
}

function overwriteExistingSettings(newConfig: {
    [collectionRoot: string]: string;
}) {
    const sectionKey = getEnvironmentSettingsKey();
    workspace.getConfiguration().update(sectionKey, undefined, true);
    workspace.getConfiguration().update(sectionKey, { ...newConfig }, true);
}
