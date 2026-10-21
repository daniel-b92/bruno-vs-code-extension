import { getRequestTypeSections } from "./diagnostics/shared/getRequestTypeSections";
import {
    BrunoFileType,
    NonBrunoSpecificItemType,
    ParsedCollectionSettingsFile,
    ParsedFolderSettingsFile,
    ParsedRequestFile,
    parseAppFile,
    parseCollectionSettingsFile,
    parseFolderSettingsFile,
    parseRequestFile,
    parseYamlEnvironmentFile,
    TextDocumentHelper,
    YamlMapDescriptor,
    YamlParsingError,
    YamlParsingErrorCode,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { CommonDiagnosticParams } from "./interfaces";
import { TypedCollectionItemProvider } from "../shared/interfaces";
import { checkExtendsFieldIsValid } from "../shared/diagnostics/environmentFiles/checkExtendsFieldIsValid";
import { checkExtendsFieldDoesNotCreateInheritanceLoop } from "../shared/diagnostics/environmentFiles/checkExtendsFieldDoesNotCreateInheritanceLoop";
import { checkSequenceDoesNotClashWithAppFiles } from "./diagnostics/checks/requestFiles/checkSequenceDoesNotClashWithAppFiles";
import { checkSequenceIsUniqueWithinFolder } from "./diagnostics/checks/requestFiles/checkSequenceIsUniqueWithinFolder";
import { checkFolderSequenceIsUnique } from "./diagnostics/checks/folderSettingsFiles/checkFolderSequenceIsUnique";
import { checkVariableDefinitionsAreValid } from "./diagnostics/checks/environmentFiles/checkVariableDefinitionsAreValid";
import { checkSettingsFileRequestSection } from "./diagnostics/shared/checkSettingsFileRequestSection";
import { checkAuthIsNotInherited } from "./diagnostics/checks/collectionSettingsFiles/checkAuthIsNotInherited";
import { checkDefaultEnvironmentExists } from "./diagnostics/checks/collectionSettingsFiles/checkDefaultEnvironmentExists";
import { checkClientCertificatesMatchType } from "./diagnostics/checks/collectionSettingsFiles/checkClientCertificatesMatchType";
import { checkEntriesAreUnique } from "./diagnostics/checks/requestFiles/checkEntriesAreUnique";
import { checkUrlMatchesParams } from "./diagnostics/checks/requestFiles/checkUrlMatchesParams";
import { checkRequestTypeMatchesSections } from "./diagnostics/checks/requestFiles/checkRequestTypeMatchesSections";
import { checkBodyTypeMatchesData } from "./diagnostics/checks/requestFiles/checkBodyTypeMatchesData";
import { checkGraphqlVariablesSyntax } from "./diagnostics/checks/requestFiles/checkGraphqlVariablesSyntax";
import { checkJsonBodySyntax } from "./diagnostics/checks/requestFiles/checkJsonBodySyntax";
import { checkWebsocketMessages } from "./diagnostics/checks/requestFiles/checkWebsocketMessages";
import { checkAuthHasRequiredFields } from "./diagnostics/checks/requestFiles/checkAuthHasRequiredFields";
import { checkAuthHasValidValues } from "./diagnostics/shared/checkAuthHasValidValues";
import { checkTagsAreUnique } from "./diagnostics/checks/requestFiles/checkTagsAreUnique";
import { getDiagnosticsForDisabledItems } from "./diagnostics/shared/getDiagnosticsForDisabledItems";
import { checkFileStartsWithExpectedSection } from "./diagnostics/shared/checkFileStartsWithExpectedSection";
import { getDiagnosticsForUnrecognizedFile } from "./diagnostics/checks/unrecognizedFiles/getDiagnosticsForUnrecognizedFile";
import { checkResponseValidationExists } from "./diagnostics/checks/requestFiles/checkResponseValidationExists";

const BRUNO_DIAGNOSTICS_SOURCE = "Bruno";
const YAML_SYNTAX_DIAGNOSTICS_SOURCE = "Bruno (YAML syntax)";

export class YamlFormatDiagnosticsProvider {
    constructor(private itemProvider: TypedCollectionItemProvider) {}

    public getDiagnosticsForYamlFile(
        filePath: string,
        content: string,
        brunoFileType: BrunoFileType | NonBrunoSpecificItemType.OtherFileType,
    ) {
        const docHelper = new TextDocumentHelper(content);
        const commonParams: CommonDiagnosticParams = {
            filePath,
            docHelper,
            fullDocumentRange: docHelper.getTextRange(),
        };

        const highlightingDiagnostic =
            brunoFileType == BrunoFileType.EnvironmentFile ||
            brunoFileType == NonBrunoSpecificItemType.OtherFileType
                ? undefined
                : checkFileStartsWithExpectedSection(commonParams);

        return [
            ...this.getDiagnosticsWithoutSource(brunoFileType, commonParams),
            ...(highlightingDiagnostic ? [highlightingDiagnostic] : []),
        ].map((diagnostic) => ({
            ...diagnostic,
            // Diagnostics without a specific source stem from Bruno specific checks.
            source: diagnostic.source ?? BRUNO_DIAGNOSTICS_SOURCE,
        }));
    }

    private getDiagnosticsWithoutSource(
        brunoFileType: BrunoFileType | NonBrunoSpecificItemType.OtherFileType,
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
            case BrunoFileType.AppFile:
                return this.getDiagnosticsForAppFile(commonParams);
            case NonBrunoSpecificItemType.OtherFileType:
                return getDiagnosticsForUnrecognizedFile(commonParams);
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

        if (!parsingResult) {
            return parsingDiagnostics;
        }
        const { enabled, disabled } = parsingResult.properties.variables ?? {
            enabled: [],
            disabled: [],
        };

        const { extends: extendsField } = parsingResult.properties;
        const collection = this.itemProvider.getAncestorCollectionForPath(
            commonParams.filePath,
        );
        // The 'extends' field is a parsed yaml map entry, so it cannot be defined multiple times.
        const extendsDiagnostics =
            extendsField && extendsField.value.trim().length > 0
                ? [
                      checkExtendsFieldIsValid(
                          commonParams.filePath,
                          extendsField,
                          collection
                              ?.getEnvironments()
                              .map(({ environmentName }) => environmentName),
                      ),
                      collection
                          ? checkExtendsFieldDoesNotCreateInheritanceLoop(
                                commonParams.filePath,
                                extendsField,
                                collection,
                            )
                          : undefined,
                  ].filter((d) => d != undefined)
                : [];

        return parsingDiagnostics.concat(
            extendsDiagnostics,
            checkVariableDefinitionsAreValid(enabled, commonParams).filter(
                (d) => d != undefined,
            ),
            getDiagnosticsForDisabledItems(disabled),
        );
    }

    public getDiagnosticsForRequestFile(
        commonParams: CommonDiagnosticParams,
    ): Diagnostic[] {
        const mapDescriptors: YamlMapDescriptor[] = [];
        const { errors, result: parsingResult } = parseRequestFile(
            commonParams.docHelper,
            { mapDescriptors },
        );
        const parsingDiagnostics = mapParsingErrorsToDiagnostics(errors);

        if (!parsingResult) {
            return parsingDiagnostics;
        }
        const { properties } = parsingResult;
        const requestTypeSections = getRequestTypeSections(properties);

        const otherDiagnostics = [
            ...checkEntriesAreUnique(properties, commonParams),
            checkSequenceIsUniqueWithinFolder(
                properties.info?.properties.sequence,
                commonParams.docHelper,
                commonParams.filePath,
                this.itemProvider,
            ),
            checkSequenceDoesNotClashWithAppFiles({
                sequence: properties.info?.properties.sequence,
                docHelper: commonParams.docHelper,
                filePath: commonParams.filePath,
                fileType: BrunoFileType.RequestFile,
                itemProvider: this.itemProvider,
            }),
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
            checkGraphqlVariablesSyntax(
                properties.graphql?.properties.body,
                commonParams.docHelper,
            ),
            ...checkWebsocketMessages(
                properties.websocket,
                commonParams.docHelper,
            ),
            ...requestTypeSections.flatMap(({ properties: { auth } }) => [
                checkAuthHasRequiredFields(auth, mapDescriptors),
                checkAuthHasValidValues(auth),
            ]),
            checkResponseValidationExists(properties.runtime, commonParams),
            ...getDiagnosticsForDisabledItems([
                ...requestTypeSections.flatMap(
                    ({ properties: { headers } }) => headers?.disabled ?? [],
                ),
                ...(properties.http?.properties.params?.disabled ?? []),
                ...getDisabledItemsFromRuntimeSection(properties.runtime),
            ]),
        ];
        return parsingDiagnostics.concat(
            otherDiagnostics.filter((d) => d != undefined),
        );
    }

    public getDiagnosticsForCollectionSettingsFile(
        commonParams: CommonDiagnosticParams,
    ): Diagnostic[] {
        const mapDescriptors: YamlMapDescriptor[] = [];
        const { errors, result: parsingResult } = parseCollectionSettingsFile(
            commonParams.docHelper,
            { mapDescriptors },
        );
        const parsingDiagnostics = mapParsingErrorsToDiagnostics(errors);

        if (!parsingResult) {
            return parsingDiagnostics;
        }
        const { properties } = parsingResult;

        const collection = this.itemProvider.getAncestorCollectionForPath(
            commonParams.filePath,
        );
        const otherDiagnostics = [
            checkDefaultEnvironmentExists(
                properties.extensions?.properties.bruno?.properties.presets
                    ?.properties.defaultEnvironment,
                collection
                    ?.getEnvironments()
                    .map(({ environmentName }) => environmentName),
            ),
            ...checkSettingsFileRequestSection(
                properties.request,
                commonParams,
                mapDescriptors,
            ),
            checkAuthIsNotInherited(properties.request?.properties.auth),
            checkAuthHasValidValues(properties.request?.properties.auth),
            ...checkClientCertificatesMatchType(
                properties.config?.properties.clientCertificates,
            ),
            ...getDiagnosticsForDisabledItems([
                ...getDisabledItemsFromRequestSection(properties.request),
                ...getDisabledProxyItems(properties.config?.properties.proxy),
                ...(
                    properties.config?.properties.clientCertificates ?? []
                ).filter(({ properties: { disabled } }) => disabled?.value),
            ]),
        ];
        return parsingDiagnostics.concat(
            otherDiagnostics.filter((d) => d != undefined),
        );
    }

    public getDiagnosticsForAppFile({
        docHelper,
        filePath,
    }: CommonDiagnosticParams): Diagnostic[] {
        const { errors, result } = parseAppFile(docHelper);

        return mapParsingErrorsToDiagnostics(errors).concat(
            checkSequenceDoesNotClashWithAppFiles({
                sequence: result?.properties.info?.properties.sequence,
                docHelper,
                filePath,
                fileType: BrunoFileType.AppFile,
                itemProvider: this.itemProvider,
            }) ?? [],
        );
    }

    public getDiagnosticsForFolderSettingsFile(
        commonParams: CommonDiagnosticParams,
    ): Diagnostic[] {
        const { docHelper } = commonParams;
        const mapDescriptors: YamlMapDescriptor[] = [];
        const { errors, result: parsingResult } = parseFolderSettingsFile(
            docHelper,
            { mapDescriptors },
        );

        const parsingDiagnostics = mapParsingErrorsToDiagnostics(errors);

        if (!parsingResult) {
            return parsingDiagnostics;
        }
        const otherDiagnostics = [
            checkFolderSequenceIsUnique(
                parsingResult.properties.info?.properties.sequence,
                commonParams.docHelper,
                commonParams.filePath,
                this.itemProvider,
            ),
            ...checkSettingsFileRequestSection(
                parsingResult.properties.request,
                commonParams,
                mapDescriptors,
            ),
            checkAuthHasValidValues(
                parsingResult.properties.request?.properties.auth,
            ),
            ...getDiagnosticsForDisabledItems(
                getDisabledItemsFromRequestSection(
                    parsingResult.properties.request,
                ),
            ),
        ];
        return parsingDiagnostics.concat(
            otherDiagnostics.filter((d) => d != undefined),
        );
    }
}

function getDisabledProxyItems(
    proxy: NonNullable<
        ParsedCollectionSettingsFile["properties"]["config"]
    >["properties"]["proxy"],
) {
    if (!proxy) {
        return [];
    }
    if (proxy.properties.disabled?.value) {
        // The auth is part of the disabled proxy, so a separate hint would be redundant.
        return [proxy];
    }
    const auth = proxy.properties.config?.properties.auth;

    return auth?.properties.disabled?.value ? [auth] : [];
}

function getDisabledItemsFromRequestSection(
    request: ParsedFolderSettingsFile["properties"]["request"],
) {
    const { headers, variables, actions } = request?.properties ?? {};

    return [
        ...(headers?.disabled ?? []),
        ...(variables?.disabled ?? []),
        ...(actions?.disabled ?? []),
    ];
}

function getDisabledItemsFromRuntimeSection(
    runtime: ParsedRequestFile["properties"]["runtime"],
) {
    const { variables, actions, assertions } = runtime?.properties ?? {};

    return [
        ...(variables?.disabled ?? []),
        ...(actions?.disabled ?? []),
        ...(assertions?.disabled ?? []),
    ];
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
