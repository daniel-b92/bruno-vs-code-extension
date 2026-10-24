import * as ts from "typescript/lib/tsserverlibrary";

type SourceFileWithCheckJsDirective = ts.SourceFile & {
    checkJsDirective?: { enabled: boolean; pos: number; end: number };
};

/**
 * The Typescript server only reports type errors for Javascript files, if `checkJs` is enabled for the project or the file contains the pragma `// @ts-check`.
 * Code blocks in `.bru` and Yaml files are handled as Javascript (see `treatCollectionFilesLikeJavascript`), but used to always be type checked.
 * Since the file content cannot be changed without shifting the positions of the code, the internal result of parsing the pragma is set instead.
 *
 * Does nothing, if the (internal) property is not available.
 */
export function enableTypeCheckingForJsFile(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName) as SourceFileWithCheckJsDirective | undefined;

    if (sourceFile && !sourceFile.checkJsDirective?.enabled) {
        sourceFile.checkJsDirective = { enabled: true, pos: 0, end: 0 };
    }
}
