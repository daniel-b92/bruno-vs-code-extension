import * as ts from "typescript/lib/tsserverlibrary";
import { isFileFromYamlCollection } from "../collection/collectionFormat";
import { originalSnapshotGettersForHosts } from "../fileContent";
import { isYamlFile } from "../fileTypes";
import { PluginConfiguration } from "../pluginConfiguration";
import {
    maskYamlCollectionFileContent,
    maskYamlFileContent,
} from "./maskYamlFileContent";

/**
 * The Typescript server parses Yaml files like Typescript files, so that the Yaml content would affect the meaning of the code within scripts.
 * Therefore, the Typescript server only gets to see the code of scripts within Yaml collection files (see `maskYamlCollectionFileContent`).
 * All other Yaml files are masked completely. The same applies to Yaml collection files, as long as Yaml collections are not supported.
 */
export function maskYamlFilesForTypescriptServer(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
) {
    const host = info.languageServiceHost;

    // Masking already masked content would remove all scripts.
    if (originalSnapshotGettersForHosts.has(host)) {
        return;
    }

    const getOriginalSnapshot = host.getScriptSnapshot.bind(host);
    const getOriginalScriptVersion = host.getScriptVersion.bind(host);
    originalSnapshotGettersForHosts.set(host, getOriginalSnapshot);
    // A new snapshot is only created, if the content of a file or the configuration changes.
    let maskedSnapshots = new WeakMap<ts.IScriptSnapshot, ts.IScriptSnapshot>();
    let configurationVersion = 0;

    configuration.onDidChange(() => {
        maskedSnapshots = new WeakMap();
        configurationVersion++;
        // The project is not set when the plugin is used without a Typescript server (e.g. in tests).
        if (info.project) {
            info.project.refreshDiagnostics();
        }
    });

    // The Typescript server only requests a new snapshot for a file, if the project version and the version of the file change.
    if (host.getProjectVersion) {
        const getOriginalProjectVersion = host.getProjectVersion.bind(host);
        host.getProjectVersion = () =>
            `${getOriginalProjectVersion()}-${configurationVersion}`;
    }

    host.getScriptVersion = (fileName) =>
        isYamlFile(fileName)
            ? `${getOriginalScriptVersion(fileName)}-${configurationVersion}`
            : getOriginalScriptVersion(fileName);

    host.getScriptSnapshot = (fileName) => {
        const originalSnapshot = getOriginalSnapshot(fileName);

        if (!originalSnapshot || !isYamlFile(fileName)) {
            return originalSnapshot;
        }

        const cachedSnapshot = maskedSnapshots.get(originalSnapshot);

        if (cachedSnapshot) {
            return cachedSnapshot;
        }

        const originalContent = originalSnapshot.getText(
            0,
            originalSnapshot.getLength(),
        );

        // Snapshots created from a string do not support incremental parsing, so the file is always parsed completely.
        const maskedSnapshot = ts.ScriptSnapshot.fromString(
            configuration.isYamlCollectionSupportEnabled() &&
                isFileFromYamlCollection(info, fileName)
                ? maskYamlCollectionFileContent(fileName, originalContent)
                : maskYamlFileContent(originalContent),
        );

        maskedSnapshots.set(originalSnapshot, maskedSnapshot);

        return maskedSnapshot;
    };
}
