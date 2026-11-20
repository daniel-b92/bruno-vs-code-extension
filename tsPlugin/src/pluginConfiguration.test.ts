import { describe, it, expect } from "@jest/globals";
import * as ts from "typescript/lib/tsserverlibrary";
import {
    createLanguageServiceWithPlugin,
    createOtherPlugin,
    createPlugin,
    createPluginForSameProject,
} from "./_testingUtils";
import { redeclaredRuntimeObjectDiagnosticCode } from "./diagnostics/getDiagnosticsForRedeclaredRuntimeObjects";

describe("Plugin configuration", () => {
    const requestFile = "/collection/request.yml";
    const scriptFile = "/shared/script.js";
    const collectionFiles = {
        "/collection/opencollection.yml": "opencollection: 1.0.0\n",
        [requestFile]: `runtime:
  scripts:
    - type: tests
      code: |-
        valeu;
`,
        [scriptFile]: "// @ts-check\nbru.getEnvVar(1);\n",
    };

    it("provides diagnostics for scripts in Yaml collection files without any configuration", () => {
        const languageService = createLanguageServiceWithPlugin(
            collectionFiles,
            createPlugin({}),
        );

        expect(
            languageService
                .getSemanticDiagnostics(requestFile)
                .map(({ code }) => code),
        ).toEqual([2_304]); // Cannot find name 'valeu'.
    });

    it("uses the configuration that the Typescript server passes on creation of the plugin", () => {
        const languageService = createLanguageServiceWithPlugin(
            collectionFiles,
            createPlugin({}),
            { additionalContextRoots: ["/shared"] },
        );

        expect(
            languageService
                .getSemanticDiagnostics(scriptFile)
                .map(({ code }) => code),
        ).toEqual([2_345]); // Argument of type 'number' is not assignable to parameter of type 'string'.
    });

    it("handles configuration changes after the plugin was created again for the same project", () => {
        const languageService = createLanguageServiceWithPlugin(
            collectionFiles,
            createPlugin({}),
        );
        // The Typescript server only passes configuration changes to the plugin module that was created last.
        const pluginAfterReload = createPlugin({});
        const languageServiceAfterReload = createPluginForSameProject(
            languageService,
            pluginAfterReload,
            { additionalContextRoots: [] },
        );

        pluginAfterReload.onConfigurationChanged({
            additionalContextRoots: ["/shared"],
        });

        expect(
            languageServiceAfterReload
                .getSemanticDiagnostics(scriptFile)
                .map(({ code }) => code),
        ).toEqual([2_345]); // Argument of type 'number' is not assignable to parameter of type 'string'.
    });

    it("keeps the plugins created before it when it is created again for the same project", () => {
        const calls: string[] = [];
        const languageService = createPluginForSameProject(
            createLanguageServiceWithPlugin(
                collectionFiles,
                createOtherPlugin("before", calls),
            ),
            createPlugin({}),
        );
        // When reloading a project, the Typescript server creates all plugins again, in the same order as before.
        const languageServiceAfterReload = createPluginForSameProject(
            createPluginForSameProject(
                languageService,
                createOtherPlugin("before after reload", calls),
            ),
            createPlugin({}),
        );

        languageServiceAfterReload.getOutliningSpans(requestFile);

        expect(calls).toEqual(["before after reload", "before"]);
    });

    it("applies its overrides only once when it is created again for the same project", () => {
        const fileName = "/collection/redeclaration.yml";
        const languageService = createLanguageServiceWithPlugin(
            {
                ...collectionFiles,
                [fileName]: `runtime:
  scripts:
    - type: tests
      code: |-
        const req = 1;
`,
            },
            createPlugin({}),
        );

        expect(
            createPluginForSameProject(languageService, createPlugin({}))
                .getSemanticDiagnostics(fileName)
                .map(({ code }) => code),
        ).toEqual([redeclaredRuntimeObjectDiagnosticCode]);
    });

    it("does not provide formatting edits for Yaml files", () => {
        const languageService =
            createLanguageServiceWithPlugin(collectionFiles);

        expect(
            languageService.getFormattingEditsForDocument(
                requestFile,
                ts.getDefaultFormatCodeSettings(),
            ),
        ).toEqual([]);
    });
});
describe("for Javascript files within additional context roots", () => {
    const scriptFile = "/shared/scripts/script.js";
    const files = {
        "/collection/bruno.json": '{ "type": "collection" }',
        [scriptFile]: "// @ts-check\nbru.getEnvVar(1);\n",
    };

    it("provides the types of the objects that are available at runtime", () => {
        const plugin = createPlugin({
            additionalContextRoots: ["/shared"],
        });

        expect(
            createLanguageServiceWithPlugin(files, plugin)
                .getSemanticDiagnostics(scriptFile)
                .map(({ code }) => code),
        ).toEqual([2_345]); // Argument of type 'number' is not assignable to parameter of type 'string'.
    });

    it("does not provide the types for other folders", () => {
        const plugin = createPlugin({
            additionalContextRoots: ["/other"],
        });

        expect(
            createLanguageServiceWithPlugin(files, plugin)
                .getSemanticDiagnostics(scriptFile)
                .map(({ code }) => code),
        ).toEqual([2_304]); // Cannot find name 'bru'.
    });

    it("handles changes of the additional context roots", () => {
        const plugin = createPlugin({});
        const languageService = createLanguageServiceWithPlugin(files, plugin);

        expect(
            languageService
                .getSemanticDiagnostics(scriptFile)
                .map(({ code }) => code),
        ).toEqual([2_304]);

        plugin.onConfigurationChanged({
            additionalContextRoots: ["\\shared\\", "/other"],
        });

        expect(
            languageService
                .getSemanticDiagnostics(scriptFile)
                .map(({ code }) => code),
        ).toEqual([2_345]);
    });

    it("does not include the virtual file with the definitions in the results for navigation", () => {
        const plugin = createPlugin({
            additionalContextRoots: ["/shared"],
        });
        const languageService = createLanguageServiceWithPlugin(
            {
                ...files,
                [scriptFile]: "bru.getEnvVar('a');\n",
            },
            plugin,
        );

        expect(
            languageService.getDefinitionAtPosition(scriptFile, "bru.".length),
        ).toEqual([]);
    });
});
