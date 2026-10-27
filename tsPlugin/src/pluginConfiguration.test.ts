import { describe, it, expect } from "@jest/globals";
import * as ts from "typescript/lib/tsserverlibrary";
import {
    createLanguageServiceWithPlugin,
    createPlugin,
    createPluginAgainForSameProject,
} from "./_testingUtils";

describe("Yaml collection support", () => {
    const requestFile = "/collection/request.yml";
    const collectionFiles = {
        "/collection/opencollection.yml": "opencollection: 1.0.0\n",
        [requestFile]: `runtime:
  scripts:
    - type: tests
      code: |-
        valeu;
`,
    };

    it("only provides diagnostics for scripts in Yaml files once Yaml collections are supported", () => {
        const plugin = createPlugin({ yamlCollectionSupport: false });
        const languageService = createLanguageServiceWithPlugin(
            collectionFiles,
            plugin,
        );

        expect(languageService.getSemanticDiagnostics(requestFile)).toEqual([]);

        plugin.onConfigurationChanged({ yamlCollectionSupport: true });

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
            { yamlCollectionSupport: true },
        );

        expect(
            languageService
                .getSemanticDiagnostics(requestFile)
                .map(({ code }) => code),
        ).toEqual([2_304]); // Cannot find name 'valeu'.
    });

    it("handles configuration changes after the plugin was created again for the same project", () => {
        const languageService = createLanguageServiceWithPlugin(
            collectionFiles,
            createPlugin({ yamlCollectionSupport: false }),
        );
        // The Typescript server only passes configuration changes to the plugin module that was created last.
        const pluginAfterReload = createPlugin({});
        const languageServiceAfterReload = createPluginAgainForSameProject(
            languageService,
            pluginAfterReload,
            { yamlCollectionSupport: false },
        );

        pluginAfterReload.onConfigurationChanged({
            yamlCollectionSupport: true,
        });

        expect(
            languageServiceAfterReload
                .getSemanticDiagnostics(requestFile)
                .map(({ code }) => code),
        ).toEqual([2_304]); // Cannot find name 'valeu'.
    });

    it("does not set up the plugin again when it is created again for the same project", () => {
        const languageService = createLanguageServiceWithPlugin(
            collectionFiles,
            createPlugin({ yamlCollectionSupport: true }),
        );

        expect(
            createPluginAgainForSameProject(
                languageService,
                createPlugin({ yamlCollectionSupport: true }),
            ),
        ).toBe(languageService);
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
