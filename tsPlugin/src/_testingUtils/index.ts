import { dirname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import init = require("../index");
import { PluginConfig } from "../pluginConfiguration";

export const helperModule = `function helper() {
    return 1;
}

module.exports = { helper };
`;

export function getDiagnosticTexts(
    languageService: ts.LanguageService,
    fileName: string,
    fileContent: string,
) {
    return [
        ...languageService.getSyntacticDiagnostics(fileName),
        ...languageService.getSemanticDiagnostics(fileName),
    ].map(({ code, start, length }) => ({
        code,
        text: fileContent.substring(start!, start! + length!),
    }));
}

export function getSemanticDiagnosticCodes(
    files: Record<string, string>,
    fileName: string,
) {
    return createLanguageServiceWithPlugin(files)
        .getSemanticDiagnostics(fileName)
        .map(({ code }) => code);
}

export function createLanguageServiceWithPlugin(
    files: Record<string, string>,
    plugin = createPlugin({ yamlCollectionSupport: true }),
    pluginConfigFromServer?: Partial<PluginConfig>,
) {
    const languageServiceHost: ts.LanguageServiceHost = {
        getScriptFileNames: () =>
            Object.keys(files).filter(
                (fileName) => !fileName.endsWith(".json"),
            ),
        getScriptVersion: () => "1",
        getScriptSnapshot: (fileName) => {
            const content = files[fileName] ?? ts.sys.readFile(fileName);

            return content != undefined
                ? ts.ScriptSnapshot.fromString(content)
                : undefined;
        },
        getCurrentDirectory: () => "/collection",
        // Like for inferred projects of the Typescript server, files with any extension are handled.
        getCompilationSettings: () => ({
            allowJs: true,
            allowNonTsExtensions: true,
            target: ts.ScriptTarget.ES2020,
        }),
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
        fileExists: (fileName) =>
            fileName in files || ts.sys.fileExists(fileName),
        readFile: (fileName) => files[fileName] ?? ts.sys.readFile(fileName),
    };
    const serverHost = {
        directoryExists: (directory: string) =>
            Object.keys(files).some((fileName) =>
                fileName.startsWith(`${directory}/`),
            ),
        getDirectories: (directory: string) => [
            ...new Set(
                Object.keys(files)
                    .filter((fileName) => fileName.startsWith(`${directory}/`))
                    .map((fileName) => fileName.slice(directory.length + 1))
                    .filter((path) => path.includes("/"))
                    .map((path) => path.split("/")[0]),
            ),
        ],
        readDirectory: (directory: string) =>
            Object.keys(files).filter(
                (fileName) => dirname(fileName) == directory,
            ),
        watchDirectory: (
            directory: string,
            callback: ts.DirectoryWatcherCallback,
            recursive?: boolean,
        ): ts.FileWatcher =>
            addWatcher(directoryWatchers, {
                path: directory,
                recursive: recursive == true,
                callback,
            }),
        watchFile: (
            fileName: string,
            callback: ts.FileWatcherCallback,
        ): ts.FileWatcher =>
            addWatcher(fileWatchers, {
                path: fileName,
                recursive: false,
                callback: (changedFile) =>
                    callback(changedFile, ts.FileWatcherEventKind.Changed),
            }),
    } as unknown as ts.server.ServerHost;

    const info = {
        languageService: ts.createLanguageService(languageServiceHost),
        languageServiceHost,
        serverHost,
        config: pluginConfigFromServer,
    } as ts.server.PluginCreateInfo;
    const languageService = plugin.create(info);
    createInfosForLanguageServices.set(languageService, info);

    return languageService;
}

/**
 * When reloading a project, the Typescript server creates a new plugin module and creates the plugin again
 * with the same language service host and the language service that the plugin returned before.
 */
export function createPluginAgainForSameProject(
    languageService: ts.LanguageService,
    plugin: ReturnType<typeof createPlugin>,
    pluginConfigFromServer?: Partial<PluginConfig>,
) {
    const info = createInfosForLanguageServices.get(languageService);

    if (!info) {
        throw new Error("The language service was not created with a plugin.");
    }

    const recreatedLanguageService = plugin.create({
        ...info,
        languageService,
        config: pluginConfigFromServer,
    } as ts.server.PluginCreateInfo);
    createInfosForLanguageServices.set(recreatedLanguageService, info);

    return recreatedLanguageService;
}

const createInfosForLanguageServices = new WeakMap<
    ts.LanguageService,
    ts.server.PluginCreateInfo
>();

export function createPlugin(config: Partial<PluginConfig>) {
    const plugin = init({ typescript: ts });
    plugin.onConfigurationChanged(config);

    return plugin;
}

export function getCodeFixNames(
    languageService: ts.LanguageService,
    fileName: string,
    fileContent: string,
    diagnosticText: string,
) {
    const diagnostic = languageService
        .getSemanticDiagnostics(fileName)
        .find(
            ({ start, length }) =>
                start != undefined &&
                length != undefined &&
                fileContent.substring(start, start + length) == diagnosticText,
        );

    if (!diagnostic || diagnostic.start == undefined) {
        throw new Error(`No diagnostic found for '${diagnosticText}'.`);
    }

    return languageService
        .getCodeFixesAtPosition(
            fileName,
            diagnostic.start,
            diagnostic.start + (diagnostic.length ?? 0),
            [diagnostic.code],
            ts.getDefaultFormatCodeSettings(),
            {},
        )
        .map(({ fixName }) => fixName);
}

export function getSelection(fileContent: string, selectedText: string) {
    const start = fileContent.indexOf(selectedText);

    return { pos: start, end: start + selectedText.length };
}

export function getEditsForRefactor(
    languageService: ts.LanguageService,
    fileName: string,
    selection: ts.TextRange,
    actionDescription: string,
    formatOptions?: ts.FormatCodeSettings,
) {
    const applicableRefactor = languageService
        .getApplicableRefactors(fileName, selection, {})
        .flatMap(({ name, actions }) =>
            actions.map((action) => ({ refactorName: name, action })),
        )
        .find(({ action }) => action.description == actionDescription);

    if (!applicableRefactor) {
        throw new Error(
            `Refactoring '${actionDescription}' is not applicable.`,
        );
    }

    return languageService.getEditsForRefactor(
        fileName,
        { ...ts.getDefaultFormatCodeSettings(), ...formatOptions },
        selection,
        applicableRefactor.refactorName,
        applicableRefactor.action.name,
        {},
    );
}

/**
 * The cursor is marked with `§`.
 */
export function removeCursor(contentWithCursor: string) {
    return {
        content: contentWithCursor.replace("§", ""),
        position: contentWithCursor.indexOf("§"),
    };
}

export function getCompletionNames(
    languageService: ts.LanguageService,
    fileName: string,
    position: number,
) {
    return (
        languageService
            .getCompletionsAtPosition(fileName, position, {})
            ?.entries.map(({ name }) => name) ?? []
    );
}

interface Watcher {
    path: string;
    recursive: boolean;
    callback: (changedFile: string) => void;
    closed: boolean;
}

export const directoryWatchers: Watcher[] = [];
export const fileWatchers: Watcher[] = [];

export function addWatcher(
    watchers: Watcher[],
    watcher: Omit<Watcher, "closed">,
): ts.FileWatcher {
    const addedWatcher = { ...watcher, closed: false };
    watchers.push(addedWatcher);

    return {
        close: () => {
            addedWatcher.closed = true;
        },
    };
}

/**
 * Like for the Typescript server, directory watchers only get notified about files that are created (or deleted).
 * Changes of the content of existing files are only reported to the watchers of the file itself.
 */
export function writeFile(
    files: Record<string, string>,
    fileName: string,
    content: string,
) {
    const isNewFile = !(fileName in files);
    files[fileName] = content;

    const notify = (watchers: Watcher[], isWatching: (w: Watcher) => boolean) =>
        watchers
            .filter((watcher) => !watcher.closed && isWatching(watcher))
            .forEach(({ callback }) => callback(fileName));

    if (isNewFile) {
        notify(
            directoryWatchers,
            ({ path, recursive }) =>
                dirname(fileName) == path ||
                (recursive && fileName.startsWith(`${path}/`)),
        );
    }

    notify(fileWatchers, ({ path }) => path == fileName);
}

export function getDiagnosticCodes(
    languageService: ts.LanguageService,
    fileName: string,
) {
    return languageService
        .getSemanticDiagnostics(fileName)
        .map(({ code }) => code);
}

export function resetWatchers() {
    directoryWatchers.length = 0;
    fileWatchers.length = 0;
}
