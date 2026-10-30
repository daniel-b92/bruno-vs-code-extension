import { posix } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { getRootFolderOfContainingCollection } from "../collection/collectionFormat";
import { findStringLiteralAtPosition } from "./findStringLiteralAtPosition";

const completableExtensions = [".js", ".cjs", ".json"];

/**
 * Returns the completions for the relative path that is passed to `require` (e.g. `require("./lib/")`), or `undefined` if the position is somewhere else.
 *
 * The Typescript server would suggest paths relative to the `.bru` or Yaml file. But Bruno resolves them relative to the root folder of the collection
 * (see `treatCollectionFilesLikeJavascript`), so the suggestions need to be computed here.
 * Paths to packages (e.g. `require("lodash")`) do not depend on the location of the file and are left to the Typescript server.
 */
export function getRelativeModulePathCompletions(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    position: number,
): ts.CompletionInfo | undefined {
    const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName);
    const collectionRoot = getRootFolderOfContainingCollection(info, fileName);
    const literal =
        sourceFile && findStringLiteralAtPosition(sourceFile, position);

    if (
        !collectionRoot ||
        !literal ||
        !isPassedToRequire(literal) ||
        !isRelativePath(literal.text)
    ) {
        return undefined;
    }

    const lastSlashIndex = literal.text.lastIndexOf("/");
    const directory = posix
        .join(collectionRoot, literal.text.slice(0, lastSlashIndex + 1))
        .replace(/(?<=.)\/$/, "");
    // Only the part behind the last slash is replaced. The Typescript server does the same for paths relative to the file.
    const fragmentStart = lastSlashIndex + 1;
    const replacementSpan =
        fragmentStart < literal.text.length
            ? {
                  start: literal.getStart(sourceFile) + 1 + fragmentStart,
                  length: literal.text.length - fragmentStart,
              }
            : undefined;

    return {
        isGlobalCompletion: false,
        isMemberCompletion: false,
        isNewIdentifierLocation: true,
        entries: getEntriesInDirectory(info, directory).map((entry) => ({
            ...entry,
            sortText: "11", // Same as the Typescript server uses for paths (`SortText.LocationPriority`).
            replacementSpan,
        })),
    };
}

function getEntriesInDirectory(
    info: ts.server.PluginCreateInfo,
    directory: string,
): Pick<ts.CompletionEntry, "name" | "kind" | "kindModifiers">[] {
    const { serverHost } = info;

    if (!serverHost.directoryExists(directory)) {
        return [];
    }

    const files = serverHost
        .readDirectory(
            directory,
            completableExtensions,
            undefined,
            undefined,
            1,
        )
        .map((filePath) => posix.basename(filePath))
        .filter((name) => completableExtensions.includes(posix.extname(name)))
        .map((name) => {
            const extension = posix.extname(name);

            return {
                // Like for other Javascript modules, the extension is not needed for `.js` files.
                name:
                    extension == ".js" ? posix.basename(name, extension) : name,
                kind: ts.ScriptElementKind.scriptElement,
                kindModifiers: extension,
            };
        });

    const directories = serverHost
        .getDirectories(directory)
        .map((path) => posix.basename(path))
        .filter((name) => name != "node_modules" && !name.startsWith("."))
        .map((name) => ({
            name,
            kind: ts.ScriptElementKind.directory,
            kindModifiers: ts.ScriptElementKindModifier.none,
        }));

    return [...files, ...directories];
}

function isPassedToRequire(literal: ts.Node) {
    const { parent } = literal;

    return (
        ts.isCallExpression(parent) &&
        parent.arguments[0] === literal &&
        ts.isIdentifier(parent.expression) &&
        parent.expression.text == "require"
    );
}

function isRelativePath(path: string) {
    return /^\.\.?(\/|$)/.test(path);
}
