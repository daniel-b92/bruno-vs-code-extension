import {
    BrunoFileType,
    parseYamlEnvironmentFile,
    TextDocumentHelper,
    YamlParsingError,
} from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
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
        _filePath: string,
        content: string,
    ): Diagnostic[] {
        const docHelper = new TextDocumentHelper(content);
        const commonParams: CommonDiagnosticParams = {
            docHelper,
            fullDocumentRange: docHelper.getTextRange(),
        };
        const parsed = parseYamlEnvironmentFile(docHelper);

        if (Array.isArray(parsed)) {
            return mapParsingErrorsToDiagnostics(parsed);
        }

        const parsingErrors = parsed.errors;
        const otherDiagnostics = [
            checkTopLevelNameIsDefined(parsed, commonParams),
        ].concat(checkVariableDefinitionsAreValid(parsed.variables));
        return otherDiagnostics
            .filter((d) => d != undefined)
            .concat(mapParsingErrorsToDiagnostics(parsingErrors));
    }
}

function mapParsingErrorsToDiagnostics(
    parsingErrors: YamlParsingError[],
): Diagnostic[] {
    return parsingErrors.map((err) => ({ ...err, code: undefined }));
}
