import {
    commands,
    ConfigurationTarget,
    ExtensionContext,
    MessageItem,
    window,
    workspace,
} from "vscode";
import { DialogOptionLabelEnum } from "@shared";
import { getFeatureToggles, yamlSupportSettingsKey } from "./getFeatureToggles";

/**
 * The setting is only read on activation, so a window reload is suggested whenever its effective value differs from the one that was used for activating.
 */
export function suggestReloadOnYamlSupportChange(context: ExtensionContext) {
    const wasYamlSupportEnabled =
        getFeatureToggles(context).yamlCollectionSupport;
    let isReloadSuggested = false;

    context.subscriptions.push(
        workspace.onDidChangeConfiguration(async (e) => {
            if (
                isReloadSuggested ||
                !e.affectsConfiguration(yamlSupportSettingsKey) ||
                getFeatureToggles(context).yamlCollectionSupport ==
                    wasYamlSupportEnabled
            ) {
                return;
            }

            isReloadSuggested = true;
            await suggestReload(
                `Yaml collection support was ${wasYamlSupportEnabled ? "disabled" : "enabled"}. Reload the window for the change to take effect?`,
            );
            isReloadSuggested = false;
        }),
    );
}

/** Suggests enabling the preview support for `yaml` collections, if the workspace contains such a collection. */
export async function suggestEnablingYamlSupport(context: ExtensionContext) {
    if (
        getFeatureToggles(context).yamlCollectionSupport ||
        !workspace
            .getConfiguration()
            .get<boolean>(getSettingsKeyForShowingSuggestion(), false)
    ) {
        return;
    }

    const yamlCollectionRootFiles = await workspace.findFiles(
        "**/opencollection.yml",
        undefined,
        1,
    );

    if (yamlCollectionRootFiles.length == 0) {
        return;
    }

    const enableOption = "Enable";
    const doNotAskAgainOption = DialogOptionLabelEnum.DoNotAskAgain;

    const pickedOption = await window.showInformationMessage<MessageItem>(
        "A collection in the Yaml format was found in the workspace. Support for these collections is currently in preview and disabled by default. Enable it?",
        { title: enableOption },
        { title: DialogOptionLabelEnum.Cancel },
        { title: doNotAskAgainOption },
    );

    if (pickedOption?.title == doNotAskAgainOption) {
        await workspace
            .getConfiguration()
            .update(
                getSettingsKeyForShowingSuggestion(),
                false,
                ConfigurationTarget.Global,
            );
    } else if (pickedOption?.title == enableOption) {
        // The reload is suggested by the listener for configuration changes.
        await workspace
            .getConfiguration()
            .update(yamlSupportSettingsKey, true, ConfigurationTarget.Global);
    }
}

async function suggestReload(message: string) {
    const reloadOption = "Reload Window";

    if (
        (await window.showInformationMessage(message, reloadOption)) ==
        reloadOption
    ) {
        await commands.executeCommand("workbench.action.reloadWindow");
    }
}

function getSettingsKeyForShowingSuggestion() {
    return "bru-as-code.suggestEnablingYamlCollectionSupport";
}
