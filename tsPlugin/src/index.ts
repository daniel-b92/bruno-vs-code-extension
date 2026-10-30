import * as ts from "typescript/lib/tsserverlibrary";
import { provideRuntimeDefinitions } from "./languageServiceHost/provideRuntimeDefinitions";
import { treatCollectionFilesLikeJavascript } from "./languageServiceHost/treatCollectionFilesLikeJavascript";
import { maskFilesWithCodeBlocksForTypescriptServer } from "./languageServiceHost/maskFilesWithCodeBlocks";
import { disposeCollectionLookup } from "./collection/collectionLookup";
import { overrideCodeChanges } from "./languageService/codeChangeOverrides";
import { overrideDiagnostics } from "./languageService/diagnosticsOverrides";
import { overrideFileRenames } from "./languageService/fileRenameOverrides";
import { overrideFormatting } from "./languageService/formattingOverrides";
import {
    overrideHoverAndCompletions,
    overrideReferencesAndDefinitions,
    overrideRename,
} from "./languageService/navigationOverrides";
import { overridePasting } from "./languageService/pasteOverrides";
import { overridePresentation } from "./languageService/presentationOverrides";
import { PluginConfig, PluginConfiguration } from "./pluginConfiguration";
import { includeCollectionFilesInConfiguredProjects } from "./projectService/includeCollectionFilesInConfiguredProjects";

interface PluginForProject {
    configuration: PluginConfiguration;
    /** The language service that the plugin returned last for the project (see `decorateLanguageService`). */
    currentLanguageService?: ts.LanguageService;
}

/**
 * When a project is reloaded (e.g. after setting the extra file extensions, see `includeCollectionFilesInConfiguredProjects`),
 * the Typescript server creates new plugin modules and creates the plugins again for the same language service host.
 * The language service passed to each plugin is the one that the plugins created before returned in total (it is not reset to the original one),
 * and only the new plugin modules get notified about configuration changes.
 * Setting up the plugin again would modify the language service host a second time.
 * So the changes to the host and the configuration are only set up once per language service host.
 * The language service is decorated again each time, so that the plugins created before this one after the reload are not dropped.
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

        const plugin = existingPlugin ?? setUpHost(info, config);
        configurationsOfProjects.add(plugin.configuration);
        plugin.currentLanguageService = decorateLanguageService(info, plugin);

        return plugin.currentLanguageService;
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

function setUpHost(
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

    const plugin = { configuration };
    pluginsForHosts.set(info.languageServiceHost, plugin);

    return plugin;
}

/**
 * After a reload, the language service that the plugin returned before is still part of the language service passed to it.
 * So that the overrides are not applied twice, a language service returned before only passes on all calls once the plugin is created again.
 */
function decorateLanguageService(
    info: ts.server.PluginCreateInfo,
    plugin: PluginForProject,
) {
    const methodNames = Object.keys(
        info.languageService,
    ) as (keyof ts.LanguageService)[];
    const decorated: ts.LanguageService = Object.create(null);

    for (const k of methodNames) {
        const x = info.languageService[k]!;
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        decorated[k] = (...args: unknown[]) =>
            // @ts-expect-error - JS runtime trickery which is tricky to type tersely
            x.apply(info.languageService, args);
    }

    const { configuration } = plugin;

    overrideDiagnostics(info, decorated, configuration);
    overrideHoverAndCompletions(info, decorated, configuration);
    overrideRename(info, decorated, configuration);
    overrideReferencesAndDefinitions(info, decorated, configuration);
    overrideCodeChanges(info, decorated);
    overrideFormatting(info, decorated);
    overrideFileRenames(info, decorated);
    overridePasting(info, decorated);
    overridePresentation(info, decorated, configuration);

    // The Typescript server disposes the language service when the project is closed.
    const disposeOriginally = decorated.dispose.bind(decorated);
    decorated.dispose = () => {
        pluginsForHosts.delete(info.languageServiceHost);
        disposeCollectionLookup(info);
        disposeOriginally();
    };

    const proxy: ts.LanguageService = Object.create(null);

    for (const k of methodNames) {
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        proxy[k] = (...args: unknown[]) =>
            plugin.currentLanguageService == proxy
                ? // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                  decorated[k].apply(decorated, args)
                : // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                  info.languageService[k]!.apply(info.languageService, args);
    }

    return proxy;
}

function isPluginConfig(config: object): config is Partial<PluginConfig> {
    return (
        "yamlCollectionSupport" in config ||
        "additionalContextRoots" in config ||
        "collectionFormats" in config
    );
}

export = init;
