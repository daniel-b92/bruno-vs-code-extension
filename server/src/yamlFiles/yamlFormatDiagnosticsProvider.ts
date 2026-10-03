import {
    BrunoFileType,
    parseCollectionSettingsFile,
    parseFolderSettingsFile,
    parseRequestFile,
    parseYamlEnvironmentFile,
    TextDocumentHelper,
    YamlParsingError,
    YamlParsingErrorCode,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { checkTopLevelNameIsDefined } from "./diagnostics/checks/environmentFiles/checkTopLevelNameIsDefined";
import { CommonDiagnosticParams } from "./interfaces";
import { checkVariableDefinitionsAreValid } from "./diagnostics/checks/environmentFiles/checkVariableDefinitionsAreValid";
import { checkSettingsFileRequestSection } from "./diagnostics/shared/checkSettingsFileRequestSection";
import { checkClientCertificatesMatchType } from "./diagnostics/checks/collectionSettingsFiles/checkClientCertificatesMatchType";
import { checkEntriesAreUnique } from "./diagnostics/checks/requestFiles/checkEntriesAreUnique";
import { checkUrlMatchesParams } from "./diagnostics/checks/requestFiles/checkUrlMatchesParams";
import { checkRequestTypeMatchesSections } from "./diagnostics/checks/requestFiles/checkRequestTypeMatchesSections";
import { checkBodyTypeMatchesData } from "./diagnostics/checks/requestFiles/checkBodyTypeMatchesData";
import { checkJsonBodySyntax } from "./diagnostics/checks/requestFiles/checkJsonBodySyntax";
import { checkAuthHasRequiredFields } from "./diagnostics/checks/requestFiles/checkAuthHasRequiredFields";
import { checkTagsAreUnique } from "./diagnostics/checks/requestFiles/checkTagsAreUnique";
import { checkResponseValidationExists } from "./diagnostics/checks/requestFiles/checkResponseValidationExists";

const BRUNO_DIAGNOSTICS_SOURCE = "Bruno";
const YAML_SYNTAX_DIAGNOSTICS_SOURCE = "Bruno (YAML syntax)";

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

        return this.getDiagnosticsWithoutSource(
            brunoFileType,
            commonParams,
        ).map((diagnostic) => ({
            ...diagnostic,
            // Diagnostics without a specific source stem from Bruno specific checks.
            source: diagnostic.source ?? BRUNO_DIAGNOSTICS_SOURCE,
        }));
    }

    private getDiagnosticsWithoutSource(
        brunoFileType: BrunoFileType,
        commonParams: CommonDiagnosticParams,
    ): Diagnostic[] {
        switch (brunoFileType) {
            case BrunoFileType.EnvironmentFile:
                return this.getDiagnosticsForEnvironmentFile(commonParams);
            case BrunoFileType.CollectionSettingsFile:
                return this.getDiagnosticsForCollectionSettingsFile(
                    commonParams,
                );
            case BrunoFileType.FolderSettingsFile:
                return this.getDiagnosticsForFolderSettingsFile(commonParams);
            case BrunoFileType.RequestFile:
                return this.getDiagnosticsForRequestFile(commonParams);
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

        // ToDo: Once yaml env files are stored in the cache, add validations for inheritance
        // (env name exists, is not own environment, no circular dependencies,...)

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

    public getDiagnosticsForRequestFile(
        commonParams: CommonDiagnosticParams,
    ): Diagnostic[] {
        const { errors, result: parsingResult } = parseRequestFile(
            commonParams.docHelper,
        );
        const parsingDiagnostics = mapParsingErrorsToDiagnostics(errors);

        if (!parsingResult) {
            return parsingDiagnostics;
        }
        const { properties } = parsingResult;

        const otherDiagnostics = [
            ...checkEntriesAreUnique(properties, commonParams),
            ...checkUrlMatchesParams(properties.http, commonParams),
            ...checkRequestTypeMatchesSections(properties, commonParams),
            ...checkTagsAreUnique(properties.info, commonParams),
            checkBodyTypeMatchesData(
                properties.http?.properties.body,
                commonParams,
            ),
            checkJsonBodySyntax(
                properties.http?.properties.body,
                commonParams.docHelper,
            ),
            checkAuthHasRequiredFields(properties.http?.properties.auth),
            checkResponseValidationExists(properties.runtime, commonParams),
        ];
        return parsingDiagnostics.concat(
            otherDiagnostics.filter((d) => d != undefined),
        );
    }

    public getDiagnosticsForCollectionSettingsFile(
        commonParams: CommonDiagnosticParams,
    ): Diagnostic[] {
        const { errors, result: parsingResult } = parseCollectionSettingsFile(
            commonParams.docHelper,
        );
        const parsingDiagnostics = mapParsingErrorsToDiagnostics(errors);

        if (!parsingResult) {
            return parsingDiagnostics;
        }
        const { properties } = parsingResult;

        // ToDo: Once yaml collections are available in the cache, check that the configured default environment in presets actually exists.
        const otherDiagnostics = [
            ...checkSettingsFileRequestSection(
                properties.request,
                commonParams,
            ),
            ...checkClientCertificatesMatchType(
                properties.config?.properties.clientCertificates,
            ),
        ];
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
        // ToDo: Once the yaml collection items are cached, check that the sequence is unique within the parent folder.
        const otherDiagnostics = checkSettingsFileRequestSection(
            parsingResult.properties.request,
            commonParams,
        );
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
        source:
            err.code == YamlParsingErrorCode.InvalidYamlSyntax
                ? YAML_SYNTAX_DIAGNOSTICS_SOURCE
                : undefined,
        severity:
            err.code == YamlParsingErrorCode.UnknownFieldInMap
                ? DiagnosticSeverity.Warning
                : undefined,
    }));
}
