import {
    BrunoFileType,
    parseYamlEnvironmentFile,
    TextDocumentHelper,
} from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { checkTopLevelNameIsDefinedInEnvironmentFile } from "./diagnostics/checks/checkTopLevelNameIsDefinedInEnvironmentFile";
import { CommonDiagnosticParams } from "./interfaces";

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
            return parsed;
        }

        const parsingErrorsAsDiagnostics = parsed.errors.map((err) => ({
            ...err,
            code: undefined,
        }));
        const otherDiagnostics = [
            checkTopLevelNameIsDefinedInEnvironmentFile(parsed, commonParams),
        ];
        return otherDiagnostics
            .filter((d) => d != undefined)
            .concat(parsingErrorsAsDiagnostics);
    }

    public dispose() {}
}
