import * as ts from "typescript/lib/tsserverlibrary";
import { maskBruFileContent } from "../bruFiles/maskBruFileContent";
import { isFileFromYamlCollection } from "../collection/collectionFormat";
import { getCollectionLookup } from "../collection/collectionLookup";
import { originalSnapshotGettersForHosts } from "../fileContent";
import { hasEmbeddedCodeBlocks, isBruFile } from "../fileTypes";
import { PluginConfiguration } from "../pluginConfiguration";
import {
    maskYamlCollectionFileContent,
    maskYamlFileContent,
} from "../yamlFiles/maskYamlFileContent";

/**
 * The Typescript server parses `.bru` and Yaml files like code files, so that the content outside of the code blocks would affect the meaning of the code.
 * Therefore, the Typescript server only gets to see the code of the code blocks within `.bru` files (see `maskBruFileContent`)
 * and of the scripts within Yaml collection files (see `maskYamlCollectionFileContent`).
 * All other Yaml files are masked completely. The same applies to Yaml collection files, as long as Yaml collections are not supported.
 */
export function maskFilesWithCodeBlocksForTypescriptServer(
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
    // A new snapshot is only created, if the content of a file, the configuration or the collections change.
    // The masked content of Yaml files depends on whether they belong to a collection.
    let maskedSnapshots = new WeakMap<ts.IScriptSnapshot, ts.IScriptSnapshot>();
    let maskingVersion = 0;

    const invalidateMaskedSnapshots = () => {
        maskedSnapshots = new WeakMap();
        maskingVersion++;
        // The project is not set when the plugin is used without a Typescript server (e.g. in tests).
        if (info.project) {
            // The Typescript server only updates the program of a project, if the project is marked as dirty (which is internal to the Typescript server).
            (
                info.project as unknown as { markAsDirty?: () => void }
            ).markAsDirty?.();
            info.project.refreshDiagnostics();
        }
    };

    configuration.onDidChange(invalidateMaskedSnapshots);
    getCollectionLookup(info).onDidChange(invalidateMaskedSnapshots);

    // The Typescript server only requests a new snapshot for a file, if the project version and the version of the file change.
    if (host.getProjectVersion) {
        const getOriginalProjectVersion = host.getProjectVersion.bind(host);
        host.getProjectVersion = () =>
            `${getOriginalProjectVersion()}-${maskingVersion}`;
    }

    host.getScriptVersion = (fileName) =>
        hasEmbeddedCodeBlocks(fileName)
            ? `${getOriginalScriptVersion(fileName)}-${maskingVersion}`
            : getOriginalScriptVersion(fileName);

    host.getScriptSnapshot = (fileName) => {
        const originalSnapshot = getOriginalSnapshot(fileName);

        if (!originalSnapshot || !hasEmbeddedCodeBlocks(fileName)) {
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
            isBruFile(fileName)
                ? maskBruFileContent(originalContent)
                : isFileFromYamlCollection(info, fileName)
                  ? maskYamlCollectionFileContent(fileName, originalContent)
                  : maskYamlFileContent(originalContent),
        );

        maskedSnapshots.set(originalSnapshot, maskedSnapshot);

        return maskedSnapshot;
    };
}
