import * as ts from "typescript/lib/tsserverlibrary";
import { maskYamlFilesForTypescriptServer } from "./yamlFiles/maskYamlFilesForTypescriptServer";
import { overrideCodeChanges } from "./languageService/codeChangeOverrides";
import { overrideDiagnostics } from "./languageService/diagnosticsOverrides";
import {
    overrideHoverAndCompletions,
    overrideReferencesAndDefinitions,
    overrideRename,
} from "./languageService/navigationOverrides";

function init(_modules: {
    typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
    function create(info: ts.server.PluginCreateInfo) {
        maskYamlFilesForTypescriptServer(info);

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

        return proxy;
    }

    return {
        create,
    };
}

export = init;
