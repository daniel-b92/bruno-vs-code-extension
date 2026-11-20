import { Position, Range, yamlFileFirstLineKeys } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../interfaces";

/**
 * The syntax highlighting for embedded code (scripts, bodies, docs,...) is only active if the first line of the file defines the `info` section
 * (or `opencollection` for collection settings files). Otherwise, the file is only highlighted as plain yaml.
 */
export function checkFileStartsWithExpectedSection({
    docHelper,
}: CommonDiagnosticParams): Diagnostic | undefined {
    const keyPattern = new RegExp(
        `^(${yamlFileFirstLineKeys.join("|")})[ \\t]*:(?:[ \\t]|$)`,
    );
    const firstKeyLine = docHelper
        .getAllLines()
        .map(({ index, content }) => ({
            index,
            key: keyPattern.exec(content)?.[1],
        }))
        .find(({ key }) => key != undefined);

    // If the section is missing altogether, that is already reported by the parsing.
    if (!firstKeyLine || firstKeyLine.index == 0) {
        return undefined;
    }
    const { index, key } = firstKeyLine;

    return {
        message: `Syntax highlighting for embedded code (scripts, bodies, docs,...) is limited, because the file does not start with the '${key}' section. Move it to the first line to enable it.`,
        range: new Range(
            new Position(index, 0),
            new Position(index, key!.length),
        ),
        severity: DiagnosticSeverity.Information,
    };
}
