import {
    ConfiguredEnvironmentPerCollectionSetting,
    getEnvironmentSettingsKey,
    isTestEnvironmentsSettingValid,
    normalizePath,
} from "@global_shared";
import { DialogOptionLabelEnum } from "@shared";
import { window, workspace } from "vscode";

export async function removeConfigForCollection(collectionRootFolder: string) {
    const oldConfigs = getOldConfigs();

    if (
        !oldConfigs ||
        !isTestEnvironmentsSettingValid(oldConfigs) ||
        Object.keys(oldConfigs).every(
            (path) =>
                normalizePath(path) != normalizePath(collectionRootFolder),
        )
    ) {
        return;
    }

    const newConfigs: ConfiguredEnvironmentPerCollectionSetting =
        Object.fromEntries(
            Object.entries(oldConfigs).filter(
                ([path]) =>
                    normalizePath(path) != normalizePath(collectionRootFolder),
            ),
        );

    await workspace
        .getConfiguration()
        .update(getEnvironmentSettingsKey(), newConfigs, true);
}

export async function updateSettings(
    collectionRootFolder: string,
    selectedEnvironmentName: string,
) {
    const newConfig = {
        [collectionRootFolder]: selectedEnvironmentName,
    };
    const oldConfigs = getOldConfigs();

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
            await overwriteExistingSettings(newConfig);
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

    await workspace
        .getConfiguration()
        .update(getEnvironmentSettingsKey(), newConfigs, true);
}

function getOldConfigs() {
    const sectionKey = getEnvironmentSettingsKey();

    // For non-defined object settings, VS Code seems to not return `undefined` when attempting ŧo get the setting.
    // Instead, it already initializes the object as `{}`.
    return [JSON.stringify({}), JSON.stringify(undefined)].includes(
        JSON.stringify(workspace.getConfiguration().get(sectionKey)),
    )
        ? undefined
        : workspace.getConfiguration().get(sectionKey);
}

async function overwriteExistingSettings(newConfig: {
    [collectionRoot: string]: string;
}) {
    const sectionKey = getEnvironmentSettingsKey();
    await workspace.getConfiguration().update(sectionKey, undefined, true);
    await workspace
        .getConfiguration()
        .update(sectionKey, { ...newConfig }, true);
}
