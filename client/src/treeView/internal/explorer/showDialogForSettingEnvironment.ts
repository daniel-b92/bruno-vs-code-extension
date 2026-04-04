import { getExtensionForBrunoFiles } from "@global_shared";
import { TypedCollection, updateSettings } from "@shared";
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

    const options: QuickPickItem[] = environments.map(({ item, selected }) => ({
        label: basename(item.getPath(), getExtensionForBrunoFiles()),
        description: selected ? "Selected" : undefined,
    }));

    const selectedOption = await window.showQuickPick(options, {
        title: `Environment for collection '${basename(collection.getRootDirectory())}'`,
    });

    if (!selectedOption) {
        return false;
    }

    await updateSettings(collection.getRootDirectory(), selectedOption.label);
    return true;
}
