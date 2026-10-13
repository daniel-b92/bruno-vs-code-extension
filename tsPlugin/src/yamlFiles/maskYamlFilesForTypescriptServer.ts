import * as ts from "typescript/lib/tsserverlibrary";
import { isFileFromYamlCollection } from "../collection/collectionFormat";
import { originalSnapshotGettersForHosts } from "../fileContent";
import { isYamlFile } from "../fileTypes";
import {
    maskYamlCollectionFileContent,
    maskYamlFileContent,
} from "./maskYamlFileContent";

/**
 * The Typescript server parses Yaml files like Typescript files, so that the Yaml content would affect the meaning of the code within scripts.
 * Therefore, the Typescript server only gets to see the code of scripts within Yaml collection files (see `maskYamlCollectionFileContent`).
 * All other Yaml files are masked completely.
 */
export function maskYamlFilesForTypescriptServer(
    info: ts.server.PluginCreateInfo,
) {
    const host = info.languageServiceHost;

    // Masking already masked content would remove all scripts.
    if (originalSnapshotGettersForHosts.has(host)) {
        return;
    }

    const getOriginalSnapshot = host.getScriptSnapshot.bind(host);
    originalSnapshotGettersForHosts.set(host, getOriginalSnapshot);
    // A new snapshot is only created, if the content of a file changes.
    const maskedSnapshots = new WeakMap<
        ts.IScriptSnapshot,
        ts.IScriptSnapshot
    >();

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
            isFileFromYamlCollection(info, fileName)
                ? maskYamlCollectionFileContent(originalContent)
                : maskYamlFileContent(originalContent),
        );

        maskedSnapshots.set(originalSnapshot, maskedSnapshot);

        return maskedSnapshot;
    };
}
