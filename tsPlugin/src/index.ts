import * as ts from "typescript/lib/tsserverlibrary";
import { provideRuntimeDefinitions } from "./languageServiceHost/provideRuntimeDefinitions";
import { treatCollectionFilesLikeJavascript } from "./languageServiceHost/treatCollectionFilesLikeJavascript";
import { maskFilesWithCodeBlocksForTypescriptServer } from "./languageServiceHost/maskFilesWithCodeBlocks";
import { overrideCodeChanges } from "./languageService/codeChangeOverrides";
import { overrideDiagnostics } from "./languageService/diagnosticsOverrides";
import { overrideFormatting } from "./languageService/formattingOverrides";
import {
    overrideHoverAndCompletions,
    overrideReferencesAndDefinitions,
    overrideRename,
} from "./languageService/navigationOverrides";
import { PluginConfig, PluginConfiguration } from "./pluginConfiguration";

function init(_modules: {
    typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
    const configuration = new PluginConfiguration();

    function create(info: ts.server.PluginCreateInfo) {
        maskFilesWithCodeBlocksForTypescriptServer(info, configuration);
        treatCollectionFilesLikeJavascript(info);
        provideRuntimeDefinitions(info);

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

        overrideDiagnostics(info, proxy);
        overrideHoverAndCompletions(info, proxy);
        overrideRename(info, proxy);
        overrideReferencesAndDefinitions(info, proxy);
        overrideCodeChanges(info, proxy);
        overrideFormatting(info, proxy);

        return proxy;
    }

    function onConfigurationChanged(config: Partial<PluginConfig> | undefined) {
        configuration.update(config);
    }

    return {
        create,
        onConfigurationChanged,
    };
}

export = init;
