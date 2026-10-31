import * as ts from "typescript/lib/tsserverlibrary";
import { CollectionFormat } from "../constants";
import { PluginConfiguration } from "../pluginConfiguration";

/**
 * Collection files always use the extension `.bru` or `.yml`.
 * Other Yaml files (e.g. with the extension `.yaml`) are masked completely, so there is no need to add them to a project.
 */
const fileExtensionsForCollectionFormats: Record<CollectionFormat, string> = {
    [CollectionFormat.Bru]: ".bru",
    [CollectionFormat.Yaml]: ".yml",
};

const registeredExtensionsForProjectServices = new WeakMap<
    ts.server.ProjectService,
    Set<string>
>();

/**
 * The Typescript server only adds files with known extensions to a configured project (when matching the `include` paths of the `tsconfig.json` / `jsconfig.json`).
 * So `.bru` and Yaml files would land in an inferred project with default compiler options, even if they are located within the folder of a `tsconfig.json`.
 * If a `tsconfig.json` only matches such files, the error "No inputs were found in config file" would be reported for it as well.
 *
 * Therefore, the file extensions of collection files are registered as Javascript extensions with the project service.
 * The Typescript server only adds files with these extensions to configured projects that allow Javascript files (`allowJs`).
 *
 * The extensions apply to all projects of the Typescript server and registering them reloads all projects.
 * So they are only registered once the workspace contains collections of the corresponding format (and for Yaml collections, only while they are supported).
 * Otherwise, every Yaml file (e.g. OpenAPI specifications) would become a root file of all projects that allow Javascript files,
 * and large ones could exceed the size limit of the Typescript server for non-Typescript files, which disables the language service for the project.
 * Registered extensions are kept until the Typescript server is restarted, since removing them would reload all projects again.
 *
 * TODO: Workspaces with Yaml collections are still affected by the issues above, if they contain other Yaml files within projects that allow Javascript files.
 * To avoid this, `.yml` could be left unregistered and the files of Yaml collections could be added to configured projects via `getExternalFiles` of the plugin module instead.
 * The Typescript server adds the returned files as root files without counting them towards the size limit (see `loadConfiguredProject` of the Typescript server).
 * But its watchers for the `include` paths ignore files with unregistered extensions, so added or deleted collection files would not be noticed.
 * The plugin would then need to update the root files of the project itself (e.g. based on the recursive watcher of the project directory in `CollectionLookup`).
 */
export function includeCollectionFilesInConfiguredProjects(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
) {
    // The project is not set when the plugin is used without a Typescript server (e.g. in tests).
    const projectService = info.project?.projectService;

    if (!projectService) {
        return;
    }

    const registerMissingExtensions = () =>
        registerExtensionsForExistingCollections(
            info,
            projectService,
            configuration,
        );

    registerMissingExtensions();
    configuration.onDidChange(registerMissingExtensions);
}

function registerExtensionsForExistingCollections(
    info: ts.server.PluginCreateInfo,
    projectService: ts.server.ProjectService,
    configuration: PluginConfiguration,
) {
    let registeredExtensions =
        registeredExtensionsForProjectServices.get(projectService);

    if (!registeredExtensions) {
        registeredExtensions = new Set();
        registeredExtensionsForProjectServices.set(
            projectService,
            registeredExtensions,
        );
    }

    const missingExtensions = getExtensionsForExistingCollections(
        configuration,
    ).filter((extension) => !registeredExtensions.has(extension));

    if (missingExtensions.length == 0) {
        return;
    }

    missingExtensions.forEach((extension) =>
        registeredExtensions.add(extension),
    );

    // Changing the file extensions reloads all projects (and creates the plugin for them again).
    // The project of the plugin may still be loading at this point, so reloading it immediately would interfere with that.
    info.serverHost.setTimeout(() => {
        projectService.setHostConfiguration({
            extraFileExtensions: getExtraFileExtensions(
                projectService,
                missingExtensions,
            ),
        });
    }, 0);
}

function getExtensionsForExistingCollections(
    configuration: PluginConfiguration,
) {
    return Object.values(CollectionFormat)
        .filter((format) => configuration.hasCollectionsWithFormat(format))
        .map((format) => fileExtensionsForCollectionFormats[format]);
}

/**
 * Setting the extra file extensions replaces the existing ones, which may have been registered by other plugins.
 */
function getExtraFileExtensions(
    projectService: ts.server.ProjectService,
    extensionsToAdd: string[],
): ts.FileExtensionInfo[] {
    // The host configuration is internal to the Typescript server.
    const existingExtensions =
        (
            projectService as unknown as {
                hostConfiguration?: {
                    extraFileExtensions?: ts.FileExtensionInfo[];
                };
            }
        ).hostConfiguration?.extraFileExtensions ?? [];

    return existingExtensions.concat(
        extensionsToAdd
            .filter(
                (extension) =>
                    !existingExtensions.some(
                        (existing) => existing.extension == extension,
                    ),
            )
            .map((extension) => ({
                extension,
                isMixedContent: false,
                scriptKind: ts.ScriptKind.JS,
            })),
    );
}
