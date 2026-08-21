import {
    BrunoFileType,
    parseFolderSettingsFile,
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
        const docHelper = new TextDocumentHelper(content);
        const commonParams: CommonDiagnosticParams = {
            filePath,
            docHelper,
            fullDocumentRange: docHelper.getTextRange(),
        };

        switch (brunoFileType) {
            case BrunoFileType.EnvironmentFile:
                return this.getDiagnosticsForEnvironmentFile(commonParams);
            case BrunoFileType.FolderSettingsFile:
                return this.getDiagnosticsForFolderSettingsFile(commonParams);
            default:
                return [];
        }
    }

    public getDiagnosticsForEnvironmentFile(
        commonParams: CommonDiagnosticParams,
    ): Diagnostic[] {
        const { docHelper } = commonParams;
        const { errors: parsingErrors, result: parsingResult } =
            parseYamlEnvironmentFile(docHelper);
        const parsingDiagnostics = mapParsingErrorsToDiagnostics(parsingErrors);

        if (!parsingResult || !parsingResult.properties.variables) {
            return parsingDiagnostics;
        }
        const { enabled, disabled } = parsingResult.properties.variables;

        const otherDiagnostics = [
            checkTopLevelNameIsDefined(parsingResult, commonParams),
        ].concat(
            checkVariableDefinitionsAreValid(
                enabled.concat(disabled),
                commonParams,
            ),
        );
        return parsingDiagnostics.concat(
            otherDiagnostics.filter((d) => d != undefined),
        );
    }

    public getDiagnosticsForFolderSettingsFile(
        commonParams: CommonDiagnosticParams,
    ): Diagnostic[] {
        const result: Diagnostic[] = [];
        const { docHelper } = commonParams;
        const { errors } = parseFolderSettingsFile(docHelper);

        result.push(...mapParsingErrorsToDiagnostics(errors));

        return result;
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
