import { getExtensionForBrunoFiles } from "@global_shared";
import { TypedCollection } from "@shared";
import { basename } from "path";
import { QuickPickItem, window } from "vscode";

export async function openDialogForSettingEnvironment(
    collection: TypedCollection,
    configuredEnvironmentName?: string,
) {
    const environments = collection.getEnvironments(configuredEnvironmentName);
    const options: QuickPickItem[] = environments.map(({ item, selected }) => ({
        label: basename(item.getPath(), getExtensionForBrunoFiles()),
        picked: selected,
    }));

    const selectedItem = await window.showQuickPick(options, {
        ignoreFocusOut: true,
        title: `Environment for collection '${basename(collection.getRootDirectory())}'`,
    });

    return selectedItem?.label;
}
