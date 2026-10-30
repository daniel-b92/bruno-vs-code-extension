import * as ts from "typescript/lib/tsserverlibrary";
import { provideRuntimeDefinitions } from "./languageServiceHost/provideRuntimeDefinitions";
import { treatCollectionFilesLikeJavascript } from "./languageServiceHost/treatCollectionFilesLikeJavascript";
import { maskFilesWithCodeBlocksForTypescriptServer } from "./languageServiceHost/maskFilesWithCodeBlocks";
import { disposeCollectionLookup } from "./collection/collectionLookup";
import { overrideCodeChanges } from "./languageService/codeChangeOverrides";
import { overrideDiagnostics } from "./languageService/diagnosticsOverrides";
import { overrideFormatting } from "./languageService/formattingOverrides";
import {
    overrideHoverAndCompletions,
    overrideReferencesAndDefinitions,
    overrideRename,
} from "./languageService/navigationOverrides";
import { PluginConfig, PluginConfiguration } from "./pluginConfiguration";
import { includeCollectionFilesInConfiguredProjects } from "./projectService/includeCollectionFilesInConfiguredProjects";

interface PluginForProject {
    languageService: ts.LanguageService;
    configuration: PluginConfiguration;
}

/**
 * When a project is reloaded (e.g. after setting the extra file extensions, see `includeCollectionFilesInConfiguredProjects`),
 * the Typescript server creates a new plugin module and creates the plugin again for the same language service host.
 * The language service passed to it is the one that the plugin returned before, and only the new plugin module gets notified about configuration changes.
 * Setting up the plugin again would stack the overrides, and the ones from the first setup would keep using the outdated configuration
 * (e.g. the virtual file with the runtime definitions would not be added after a configuration change).
 * So the plugin is only set up once per language service host. Creating it again only passes on the configuration.
 */
const pluginsForHosts = new WeakMap<ts.LanguageServiceHost, PluginForProject>();

function init(_modules: {
    typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
    // The Typescript server creates the plugin module once per project, but without the server it can be used for several projects (e.g. in tests).
    const configurationsOfProjects = new Set<PluginConfiguration>();
    let latestConfig: Partial<PluginConfig> | undefined;

    function create(info: ts.server.PluginCreateInfo) {
        // If the plugin was configured before the project was created, the Typescript server passes the configuration this way
        // instead of calling `onConfigurationChanged`.
        const config =
            info.config && isPluginConfig(info.config)
                ? info.config
                : latestConfig;
        const existingPlugin = pluginsForHosts.get(info.languageServiceHost);

        if (existingPlugin && config) {
            existingPlugin.configuration.update(config);
        }

        const plugin = existingPlugin ?? setUpPlugin(info, config);
        configurationsOfProjects.add(plugin.configuration);

        return plugin.languageService;
    }

    function onConfigurationChanged(config: Partial<PluginConfig> | undefined) {
        latestConfig = config;
        configurationsOfProjects.forEach((configuration) =>
            configuration.update(config),
        );
    }

    return {
        create,
        onConfigurationChanged,
    };
}

function setUpPlugin(
    info: ts.server.PluginCreateInfo,
    config: Partial<PluginConfig> | undefined,
): PluginForProject {
    const configuration = new PluginConfiguration();

    // The configuration is set before the host is modified, so that the listeners for configuration changes are not notified while the project is still being loaded.
    if (config) {
        configuration.update(config);
    }

    includeCollectionFilesInConfiguredProjects(info, configuration);
    maskFilesWithCodeBlocksForTypescriptServer(info, configuration);
    treatCollectionFilesLikeJavascript(info);
    provideRuntimeDefinitions(info, configuration);

    // Set up decorator object
    const proxy: ts.LanguageService = Object.create(null);

    for (const k of Object.keys(
        info.languageService,
    ) as (keyof ts.LanguageService)[]) {
        const x = info.languageService[k]!;
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        proxy[k] = (...args: unknown[]) =>
            // @ts-expect-error - JS runtime trickery which is tricky to type tersely
            x.apply(info.languageService, args);
    }

    overrideDiagnostics(info, proxy, configuration);
    overrideHoverAndCompletions(info, proxy, configuration);
    overrideRename(info, proxy, configuration);
    overrideReferencesAndDefinitions(info, proxy, configuration);
    overrideCodeChanges(info, proxy);
    overrideFormatting(info, proxy);

    // The Typescript server disposes the language service when the project is closed.
    const disposeOriginally = proxy.dispose.bind(proxy);
    proxy.dispose = () => {
        pluginsForHosts.delete(info.languageServiceHost);
        disposeCollectionLookup(info);
        disposeOriginally();
    };

    const plugin = { languageService: proxy, configuration };
    pluginsForHosts.set(info.languageServiceHost, plugin);

    return plugin;
}

function isPluginConfig(config: object): config is Partial<PluginConfig> {
    return (
        "yamlCollectionSupport" in config ||
        "additionalContextRoots" in config ||
        "collectionFormats" in config
    );
}

export = init;
