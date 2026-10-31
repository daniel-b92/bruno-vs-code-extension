import * as ts from "typescript/lib/tsserverlibrary";
import { getCodeRanges } from "../codeBlocks/getCodeRanges";
import { getTopLevelDeclarations } from "../codeBlocks/getTopLevelDeclarations";
import { getOriginalFileContent } from "../fileContent";

export const redeclaredRuntimeObjectDiagnosticCode = 100_001;

/**
 * Like the Bruno app, a warning is shown when a code block declares a variable with the name of an object that Bruno provides at runtime.
 * The declaration itself is valid, since each code block is executed in its own function.
 */
export function getDiagnosticsForRedeclaredRuntimeObjects(
    info: ts.server.PluginCreateInfo,
    fileName: string,
): ts.Diagnostic[] {
    const fileContent = getOriginalFileContent(info, fileName);
    const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName);

    if (fileContent == undefined || !sourceFile) {
        return [];
    }

    return getCodeRanges(info, fileName).flatMap(
        ({ start: codeStart, end: codeEnd }) =>
            getTopLevelDeclarations(fileContent.substring(codeStart, codeEnd))
                .filter(({ name }) => ["bru", "req", "res"].includes(name))
                .map(({ name, start, length }) => ({
                    file: sourceFile,
                    start: codeStart + start,
                    length,
                    category: ts.DiagnosticCategory.Warning,
                    code: redeclaredRuntimeObjectDiagnosticCode,
                    source: "bru-as-code",
                    messageText: `'${name}' shadows the object of the same name that Bruno provides at runtime.`,
                })),
    );
}
