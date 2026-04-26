import { getExtensionForBrunoFiles } from "@global_shared";
import {
    removeConfigForCollection,
    TypedCollection,
    updateSettings,
} from "@shared";
import { basename } from "path";
import { QuickPickItem, window } from "vscode";

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

    const labelForNoSelectedEnvironment = "None";

    const options: QuickPickItem[] = (
        environments.map(({ item, selected }) => ({
            label: basename(item.getPath(), getExtensionForBrunoFiles()),
            description: selected ? "Selected" : undefined,
        })) as QuickPickItem[]
    ).concat({
        label: labelForNoSelectedEnvironment,
        description:
            configuredEnvironmentName == undefined ? "Selected" : undefined,
        detail: "Option for not selecting an environment",
    });

    const selectedOption = await window.showQuickPick(options, {
        title: `Environment for collection '${basename(collection.getRootDirectory())}'`,
    });

    if (!selectedOption) {
        return false;
    }

    if (selectedOption.label == labelForNoSelectedEnvironment) {
        await removeConfigForCollection(collection.getRootDirectory());
        return true;
    }

    await updateSettings(collection.getRootDirectory(), selectedOption.label);
    return true;
}
