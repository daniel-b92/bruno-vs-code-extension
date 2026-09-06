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
import { checkNamePropertyIsUniqueAcrossMaps } from "./diagnostics/shared/checkNamePropertyIsUniqueAcrossMaps";
import { checkVariableTypesMatchValueData } from "./diagnostics/shared/checkVariableValuesMatchTypes";
import { checkTypePropertyIsUniqueAcrossMaps } from "./diagnostics/shared/checkTypePropertyIsUniqueAcrossMaps";

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
            checkTopLevelNameIsDefined(
                parsingResult.missingProperties,
                commonParams,
            ),
        ].concat(
            checkVariableDefinitionsAreValid(
                { enabled, disabled },
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
        const { docHelper } = commonParams;
        const { errors, result: parsingResult } =
            parseFolderSettingsFile(docHelper);

        const parsingDiagnostics = mapParsingErrorsToDiagnostics(errors);

        if (!parsingResult) {
            return parsingDiagnostics;
        }
        const requestProps = parsingResult.properties.request?.properties;

        if (!requestProps) {
            return parsingDiagnostics;
        }
        const { actions, headers, scripts, variables } = requestProps;

        // ToDo: Once the yaml collection items are cached, check that the sequence is unique within the parent folder.
        const otherDiagnostics = variables
            ? checkNamePropertyIsUniqueAcrossMaps(
                  variables.enabled,
                  commonParams,
              ).concat(
                  checkVariableTypesMatchValueData(
                      variables.enabled,
                      commonParams,
                  ),
                  headers
                      ? checkNamePropertyIsUniqueAcrossMaps(
                            headers,
                            commonParams,
                        )
                      : [],
                  actions
                      ? checkTypePropertyIsUniqueAcrossMaps(
                            actions.enabled,
                            commonParams,
                        )
                      : [],
                  scripts
                      ? checkTypePropertyIsUniqueAcrossMaps(
                            scripts,
                            commonParams,
                        )
                      : [],
              )
            : [];
        return parsingDiagnostics.concat(
            otherDiagnostics.filter((d) => d != undefined),
        );
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
