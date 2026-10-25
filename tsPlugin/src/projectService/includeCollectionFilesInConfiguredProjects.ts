import * as ts from "typescript/lib/tsserverlibrary";

/**
 * Collection files always use the extension `.bru` or `.yml`.
 * Other Yaml files (e.g. with the extension `.yaml`) are masked completely, so there is no need to add them to a project.
 */
const collectionFileExtensions = [".bru", ".yml"];

const projectServicesWithCollectionFileExtensions =
    new WeakSet<ts.server.ProjectService>();

/**
 * The Typescript server only adds files with known extensions to a configured project (when matching the `include` paths of the `tsconfig.json` / `jsconfig.json`).
 * So `.bru` and Yaml files would land in an inferred project with default compiler options, even if they are located within the folder of a `tsconfig.json`.
 * If a `tsconfig.json` only matches such files, the error "No inputs were found in config file" would be reported for it as well.
 *
 * Therefore, the file extensions of collection files are registered as Javascript extensions with the project service.
 * The Typescript server only adds files with these extensions to configured projects that allow Javascript files (`allowJs`).
 */
export function includeCollectionFilesInConfiguredProjects(
    info: ts.server.PluginCreateInfo,
) {
    // The project is not set when the plugin is used without a Typescript server (e.g. in tests).
    const projectService = info.project?.projectService;

    if (
        !projectService ||
        projectServicesWithCollectionFileExtensions.has(projectService)
    ) {
        return;
    }

    projectServicesWithCollectionFileExtensions.add(projectService);

    // Changing the file extensions reloads all projects (and creates the plugin for them again).
    // The project of the plugin is still being loaded at this point, so reloading it immediately would interfere with that.
    info.serverHost.setTimeout(() => {
        projectService.setHostConfiguration({
            extraFileExtensions: getExtraFileExtensions(projectService),
        });
    }, 0);
}

/**
 * Setting the extra file extensions replaces the existing ones, which may have been registered by other plugins.
 */
function getExtraFileExtensions(
    projectService: ts.server.ProjectService,
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
        collectionFileExtensions
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
