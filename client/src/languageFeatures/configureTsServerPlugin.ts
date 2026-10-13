import { ExtensionContext, extensions } from "vscode";
import { OutputChannelLogger } from "@shared";
import { FeatureToggles } from "@global_shared";

interface TypescriptLanguageFeaturesApi {
    configurePlugin(pluginId: string, configuration: unknown): void;
}

/**
 * Passes the feature toggles to the Typescript server plugin (see `PluginConfiguration` in the plugin).
 * The Typescript extension keeps the configuration, so that it is also passed to the plugin after a restart of the Typescript server.
 */
export async function configureTsServerPlugin(
    context: ExtensionContext,
    { yamlCollectionSupport }: FeatureToggles,
    logger?: OutputChannelLogger,
) {
    // The plugin does not support Yaml collections by default.
    if (!yamlCollectionSupport) {
        return;
    }

    const pluginName = getTsServerPluginName(context);
    const tsExtension = extensions.getExtension<{
        getAPI(version: 0): TypescriptLanguageFeaturesApi | undefined;
    }>("vscode.typescript-language-features");

    if (!pluginName || !tsExtension) {
        logger?.warn(
            "Could not configure Typescript server plugin, since the plugin or the Typescript extension could not be found.",
        );
        return;
    }

    try {
        const api = (await tsExtension.activate()).getAPI(0);

        if (!api) {
            throw new Error("API of Typescript extension is not available.");
        }

        api.configurePlugin(pluginName, { yamlCollectionSupport });
    } catch (err) {
        logger?.warn(
            `Could not configure Typescript server plugin: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

// The name differs when using a local build of the plugin (see the README of the plugin).
function getTsServerPluginName({
    extension: { packageJSON },
}: ExtensionContext) {
    const { contributes } = packageJSON as {
        contributes?: { typescriptServerPlugins?: { name: string }[] };
    };

    return contributes?.typescriptServerPlugins?.[0]?.name;
}
