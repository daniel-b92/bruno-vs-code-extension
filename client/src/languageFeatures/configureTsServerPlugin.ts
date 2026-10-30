import { ExtensionContext, extensions } from "vscode";
import { OutputChannelLogger, TypedCollectionItemProvider } from "@shared";
import { CollectionFormat, FeatureToggles } from "@global_shared";

interface TypescriptLanguageFeaturesApi {
    configurePlugin(pluginId: string, configuration: unknown): void;
}

/**
 * Passes the feature toggles, the additional context roots and the formats of the collections to the Typescript server plugin (see `PluginConfiguration` in the plugin).
 * The Typescript extension keeps the configuration, so that it is also passed to the plugin after a restart of the Typescript server.
 */
export async function configureTsServerPlugin(
    context: ExtensionContext,
    { yamlCollectionSupport }: FeatureToggles,
    collectionItemProvider: TypedCollectionItemProvider,
    logger?: OutputChannelLogger,
) {
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

        let lastConfiguration: string | undefined;

        const updateConfiguration = () => {
            const configuration = {
                yamlCollectionSupport,
                additionalContextRoots:
                    collectionItemProvider.getUniqueAdditionalContextRoots(),
                // The plugin only adds collection files to the projects of the Typescript server, if collections of the format exist.
                collectionFormats: collectionItemProvider
                    .getRegisteredCollections()
                    .map(
                        (collection) =>
                            collectionFormatsForPlugin[collection.getFormat()],
                    )
                    .filter(
                        (format, index, array) =>
                            array.indexOf(format) === index,
                    ),
            };
            const serializedConfiguration = JSON.stringify(configuration);

            if (serializedConfiguration != lastConfiguration) {
                lastConfiguration = serializedConfiguration;
                api.configurePlugin(pluginName, configuration);
            }
        };

        updateConfiguration();

        // The collection cache is loaded lazily, so the additional context roots are only known after it has been loaded.
        collectionItemProvider.subscribeToInitialCacheLoad(updateConfiguration);
        collectionItemProvider.subscribeToUpdates(updateConfiguration);
        collectionItemProvider.subscribeToAdditionalContextRootChanges(
            updateConfiguration,
        );
    } catch (err) {
        logger?.warn(
            `Could not configure Typescript server plugin: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

// The plugin is a standalone package and uses its own values for the collection formats.
const collectionFormatsForPlugin: Record<CollectionFormat, string> = {
    [CollectionFormat.Bru]: "bru",
    [CollectionFormat.Yaml]: "yaml",
};

// The name differs when using a local build of the plugin (see the README of the plugin).
function getTsServerPluginName({
    extension: { packageJSON },
}: ExtensionContext) {
    const { contributes } = packageJSON as {
        contributes?: { typescriptServerPlugins?: { name: string }[] };
    };

    return contributes?.typescriptServerPlugins?.[0]?.name;
}
