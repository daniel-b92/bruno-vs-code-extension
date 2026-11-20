import { describe, it, expect } from "@jest/globals";
import * as ts from "typescript/lib/tsserverlibrary";
import { CollectionFormat } from "./constants";
import { PluginConfig, PluginConfiguration } from "./pluginConfiguration";
import { includeCollectionFilesInConfiguredProjects } from "./projectService/includeCollectionFilesInConfiguredProjects";

describe("File extensions of collection files", () => {
    it("does not register any extensions while the workspace contains no collections", () => {
        const projectService = createProjectService();

        setUpForProject(projectService, { collectionFormats: [] });

        expect(projectService.setHostConfigurationCalls).toBe(0);
        expect(projectService.getExtraFileExtensions()).toEqual([]);
    });

    it("only registers the extension of `.bru` files for Bru collections", () => {
        const projectService = createProjectService();

        setUpForProject(projectService, {
            collectionFormats: [CollectionFormat.Bru],
        });

        expect(projectService.getExtraFileExtensions()).toEqual([".bru"]);
    });

    it("only registers the extension of Yaml files for Yaml collections", () => {
        const projectService = createProjectService();

        setUpForProject(projectService, {
            collectionFormats: [CollectionFormat.Yaml],
        });

        expect(projectService.getExtraFileExtensions()).toEqual([".yml"]);
    });

    it("registers extensions once collections are found and keeps the existing ones", () => {
        const projectService = createProjectService([".vue"]);
        const configuration = setUpForProject(projectService, {
            collectionFormats: [],
        });

        configuration.update({ collectionFormats: [CollectionFormat.Bru] });
        projectService.runPendingTimeouts();

        expect(projectService.getExtraFileExtensions()).toEqual([
            ".vue",
            ".bru",
        ]);
    });

    it("registers each extension only once per project service", () => {
        const projectService = createProjectService();
        const config: Partial<PluginConfig> = {
            collectionFormats: [CollectionFormat.Bru],
        };
        const configuration = setUpForProject(projectService, config);
        setUpForProject(projectService, config);

        configuration.update({
            ...config,
            additionalContextRoots: ["/additional"],
        });
        projectService.runPendingTimeouts();

        expect(projectService.setHostConfigurationCalls).toBe(1);
        expect(projectService.getExtraFileExtensions()).toEqual([".bru"]);
    });

    it("does not reload the projects before the project of the plugin has been loaded", () => {
        const projectService = createProjectService();
        const configuration = new PluginConfiguration();
        configuration.update({ collectionFormats: [CollectionFormat.Bru] });

        includeCollectionFilesInConfiguredProjects(
            projectService.createInfo(),
            configuration,
        );

        expect(projectService.setHostConfigurationCalls).toBe(0);

        projectService.runPendingTimeouts();

        expect(projectService.setHostConfigurationCalls).toBe(1);
    });
});

function setUpForProject(
    projectService: ReturnType<typeof createProjectService>,
    config: Partial<PluginConfig>,
) {
    const configuration = new PluginConfiguration();
    configuration.update(config);

    includeCollectionFilesInConfiguredProjects(
        projectService.createInfo(),
        configuration,
    );
    projectService.runPendingTimeouts();

    return configuration;
}

/**
 * Only provides the parts of the project service of the Typescript server that are used for registering file extensions.
 */
function createProjectService(existingExtensions: string[] = []) {
    const pendingTimeouts: (() => void)[] = [];
    const projectService = {
        hostConfiguration: {
            extraFileExtensions: existingExtensions.map<ts.FileExtensionInfo>(
                (extension) => ({
                    extension,
                    isMixedContent: true,
                    scriptKind: ts.ScriptKind.Deferred,
                }),
            ),
        },
        setHostConfigurationCalls: 0,
        setHostConfiguration({
            extraFileExtensions,
        }: ts.server.protocol.ConfigureRequestArguments) {
            this.setHostConfigurationCalls++;
            this.hostConfiguration.extraFileExtensions =
                extraFileExtensions ?? [];
        },
    };
    const serverHost = {
        setTimeout: (callback: () => void) => pendingTimeouts.push(callback),
    };

    return {
        get setHostConfigurationCalls() {
            return projectService.setHostConfigurationCalls;
        },
        getExtraFileExtensions: () =>
            projectService.hostConfiguration.extraFileExtensions.map(
                ({ extension }) => extension,
            ),
        createInfo: () =>
            ({
                project: { projectService },
                serverHost,
            }) as unknown as ts.server.PluginCreateInfo,
        runPendingTimeouts: () =>
            pendingTimeouts.splice(0).forEach((callback) => callback()),
    };
}
