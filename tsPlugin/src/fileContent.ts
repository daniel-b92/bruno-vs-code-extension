import * as ts from "typescript/lib/tsserverlibrary";

export const originalSnapshotGettersForHosts = new WeakMap<
    ts.LanguageServiceHost,
    (fileName: string) => ts.IScriptSnapshot | undefined
>();

export function getFileContent(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    const scriptSnapshot = info.languageServiceHost.getScriptSnapshot(fileName);

    if (scriptSnapshot) {
        return scriptSnapshot.getText(0, scriptSnapshot.getLength());
    } else {
        return info.languageServiceHost.readFile(fileName);
    }
}

/**
 * For `.bru` and Yaml files, the content returned by the language service host is masked (see `maskFilesWithCodeBlocksForTypescriptServer`).
 */
export function getOriginalFileContent(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    const getOriginalSnapshot = originalSnapshotGettersForHosts.get(
        info.languageServiceHost,
    );
    const scriptSnapshot = getOriginalSnapshot
        ? getOriginalSnapshot(fileName)
        : info.languageServiceHost.getScriptSnapshot(fileName);

    return scriptSnapshot
        ? scriptSnapshot.getText(0, scriptSnapshot.getLength())
        : info.languageServiceHost.readFile(fileName);
}
