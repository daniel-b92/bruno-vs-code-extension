import {
    BrunoFileType,
    parseYamlEnvironmentFile,
    TextDocumentHelper,
    YamlParsingError,
    YamlParsingErrorCode,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { checkTopLevelNameIsDefined } from "./diagnostics/checks/environmentFiles/checkTopLevelNameIsDefined";
import { CommonDiagnosticParams } from "./interfaces";
import { checkVariableDefinitionsAreValid } from "./diagnostics/checks/environmentFiles/checkVariableDefinitionsAreValid";

export class YamlFormatDiagnosticsProvider {
    constructor() {}

    public getDiagnosticsForYamlFile(
        filePath: string,
        content: string,
        brunoFileType: BrunoFileType,
    ) {
        switch (brunoFileType) {
            case BrunoFileType.EnvironmentFile:
                return this.getDiagnosticsForEnvironmentFile(filePath, content);
            default:
                return [];
        }
    }

    public getDiagnosticsForEnvironmentFile(
        filePath: string,
        content: string,
    ): Diagnostic[] {
        const docHelper = new TextDocumentHelper(content);
        const commonParams: CommonDiagnosticParams = {
            filePath,
            docHelper,
            fullDocumentRange: docHelper.getTextRange(),
        };
        const parsed = parseYamlEnvironmentFile(docHelper);

        if (Array.isArray(parsed)) {
            return mapParsingErrorsToDiagnostics(parsed);
        }

        const parsingErrors = parsed.errors;
        const otherDiagnostics = [
            checkTopLevelNameIsDefined(parsed.result, commonParams),
        ].concat(
            checkVariableDefinitionsAreValid(
                parsed.result.variables,
                commonParams,
            ),
        );
        return otherDiagnostics
            .filter((d) => d != undefined)
            .concat(mapParsingErrorsToDiagnostics(parsingErrors));
    }
}

function mapParsingErrorsToDiagnostics(
    parsingErrors: YamlParsingError[],
): Diagnostic[] {
    return parsingErrors.map((err) => ({
        ...err,
        code: undefined,
        severity:
            err.code == YamlParsingErrorCode.UnknownFieldInMap
                ? DiagnosticSeverity.Warning
                : undefined,
    }));
}
