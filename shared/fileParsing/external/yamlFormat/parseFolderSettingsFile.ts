import {
    BrunoFileType,
    OrAbsenceReason,
    ParsedFolderSettingsFile,
    ParsedInfoForFolderSettings,
    ReasonForFieldAbsence,
    TextDocumentHelper,
    YamlParsingError,
    YamlParsingErrorCode,
    extractResultAndErrorsFromParsingResult,
} from "../../..";
import {
    CommonParsingArgs,
    ParsedDocsWithType,
    ParsingResult,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../../internal/yamlFormat/interfaces";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { YAMLMap } from "yaml";
import { parseHeadersFromSequence } from "../../internal/yamlFormat/brunoSpecific/parseHeadersFromSequence";
import { parseAuthFromYamlMapOrScalar } from "../../internal/yamlFormat/brunoSpecific/parseAuthFromYamlMapOrScalar";
import { parseVariablesFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseVariablesFromYamlSequence";
import { parseScriptsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseScriptsFromYamlSequence";
import { parseActionsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseActionsFromYamlSequence";
import {
    FolderSettingsRequestSectionProperty,
    TopLevelFolderSettingsProperty,
} from "../../internal/yamlFormat/brunoSpecific/constants/folderSettingsFileConstants";
import { parseDocsFromYamlMapOrScalar } from "../../internal/yamlFormat/brunoSpecific/parseDocsFromYamlMapOrScalar";

export function parseFolderSettingsFile(
    docHelper: TextDocumentHelper,
): ParsingResult<ParsedFolderSettingsFile> {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];
    const expectedTopLevelProperties = Object.values(
        TopLevelFolderSettingsProperty,
    );

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap.errors;
    }

    const { map: topLevelMap } = maybeTopLevelMap;
    const {
        items: {
            missingKeys,
            unknownKeys,
            validMaps,
            validScalars: { withUnknownValue: validScalars },
        },
        errors: mapItemErrors,
    } = getMapItems(
        topLevelMap,
        {
            // Docs section can either be a scalar or a map.
            scalars: { unknownValues: [TopLevelFolderSettingsProperty.Docs] },
            mapValues: expectedTopLevelProperties,
        },
        commonArgs,
    );

    collectedErrors.push(
        ...mapItemErrors.concat(
            unknownKeys.map(({ key: unknownKey, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey,
                    keyRange,
                    allowedKeys: expectedTopLevelProperties,
                }),
            ),
        ),
    );

    const request = getParsedRequest(
        { missingKeys, validSecondLevelMaps: validMaps },
        commonArgs,
        collectedErrors,
    );
    const docs = getParsedDocs(
        { allValidMaps: validMaps, allValidScalars: validScalars, missingKeys },
        commonArgs,
        collectedErrors,
    );

    const infoMap = validMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Info,
    );
    const info = infoMap
        ? getParsedInfo(infoMap, commonArgs, collectedErrors)
        : undefined;
    if (!info) {
        // The info property is the only mandatory one.
        const isMissing = missingKeys.includes(
            TopLevelFolderSettingsProperty.Info,
        );

        if (isMissing) {
            collectedErrors.push(
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    missingKey: TopLevelFolderSettingsProperty.Info,
                    map: topLevelMap,
                }),
            );
        }

        return {
            errors: collectedErrors,
            result: {
                info: {
                    reason: isMissing
                        ? ReasonForFieldAbsence.Missing
                        : ReasonForFieldAbsence.Invalid,
                },
                docs,
                request,
            },
        };
    }

    return { errors: collectedErrors, result: { info, request, docs } };
}

function getParsedInfo(
    infoMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedInfoForFolderSettings | undefined {
    const infoResult = parseFileInfoFromYamlMap({
        infoMap,
        commonArgs,
        fileType: BrunoFileType.FolderSettingsFile,
    }) as ParsingResult<ParsedInfoForFolderSettings>;
    const { result: info, errors: infoErrors } =
        extractResultAndErrorsFromParsingResult(infoResult);
    collectedErrors.push(...infoErrors);

    return info;
}

function getParsedDocs(
    parsedData: {
        allValidMaps: WithKeyAndKeyRange<YAMLMap>[];
        allValidScalars: WithKeyKeyRangeAndValueRange<unknown>[];
        missingKeys: string[];
    },
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): OrAbsenceReason<ParsedDocsWithType> {
    const { allValidMaps, allValidScalars, missingKeys } = parsedData;
    const map = allValidMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Docs,
    );
    const untypedScalar = allValidScalars.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Docs,
    );
    if (map && untypedScalar) {
        return { reason: ReasonForFieldAbsence.Invalid };
    }
    if (!map && !untypedScalar) {
        return {
            reason: getAbsenceReasonForField(
                missingKeys,
                TopLevelFolderSettingsProperty.Docs,
            ),
        };
    }
    if (
        untypedScalar &&
        untypedScalar.value !== null &&
        typeof untypedScalar.value != "string"
    ) {
        collectedErrors.push({
            code: YamlParsingErrorCode.Other,
            message: `Docs field may only be a string or NULL, if it's a Yaml scalar`,
            range: untypedScalar.valueRange,
        });
        return { reason: ReasonForFieldAbsence.Invalid };
    }

    const docs = (map?.value ??
        (untypedScalar as
            | WithKeyKeyRangeAndValueRange<null>
            | WithKeyKeyRangeAndValueRange<string>
            | undefined))!;

    const parsingResult = parseDocsFromYamlMapOrScalar(docs, commonArgs);
    const { result, errors: parsingErrors } =
        extractResultAndErrorsFromParsingResult(parsingResult);
    collectedErrors.push(...parsingErrors);

    return result ?? { reason: ReasonForFieldAbsence.Invalid };
}

function getParsedRequest(
    parsedData: {
        validSecondLevelMaps: WithKeyAndKeyRange<YAMLMap>[];
        missingKeys: string[];
    },
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const { missingKeys, validSecondLevelMaps } = parsedData;
    const requestMap = validSecondLevelMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Request,
    );

    if (!requestMap) {
        return {
            reason: getAbsenceReasonForField(
                missingKeys,
                TopLevelFolderSettingsProperty.Request,
            ),
        };
    }
    const {
        auth: parsedAuth,
        headers: parsedHeaders,
        variables: parsedVariables,
        scripts: parsedScripts,
        actions: parsedActions,
    } = parseRequestSection(requestMap.value, commonArgs);
    const { result: auth, errors: authErrors } = parsedAuth;
    const { result: headers, errors: headerErrors } = parsedHeaders;
    const { result: variables, errors: variableErrors } = parsedVariables;
    const { result: scripts, errors: scriptErrors } = parsedScripts;
    const { result: actions, errors: actionsErrors } = parsedActions;
    collectedErrors.push(
        ...authErrors,
        ...headerErrors,
        ...variableErrors,
        ...scriptErrors,
        ...actionsErrors,
    );

    return { auth, headers, variables, scripts, actions };
}

function parseRequestSection(
    requestMap: YAMLMap,
    commonArgs: CommonParsingArgs,
) {
    const collectedErrors: YamlParsingError[] = [];
    const expectedSequences = [
        FolderSettingsRequestSectionProperty.Headers,
        FolderSettingsRequestSectionProperty.Variables,
        FolderSettingsRequestSectionProperty.Scripts,
        FolderSettingsRequestSectionProperty.Actions,
    ];
    const expectedMaps = [FolderSettingsRequestSectionProperty.Auth];
    // Auth can either be a Scalar string with the value 'inherit' or a map with a specific type.
    const expectedScalarStrings = [FolderSettingsRequestSectionProperty.Auth];
    const allowedKeys = expectedSequences.concat(expectedMaps);

    const {
        items: {
            missingKeys,
            unknownKeys,
            validMaps,
            validSequences,
            validScalars: { withStringValue: validStringScalars },
        },
        errors: sectionErrors,
    } = getMapItems(
        requestMap,
        {
            scalars: { stringValues: expectedScalarStrings },
            mapValues: allowedKeys,
            sequenceValues: expectedSequences,
        },
        commonArgs,
    );

    collectedErrors.push(
        ...sectionErrors.concat(
            unknownKeys.map(({ key: unknownKey, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey,
                    keyRange,
                    allowedKeys,
                }),
            ),
        ),
    );

    const maybeHeadersSequence = validSequences.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Headers,
    );
    const headers = maybeHeadersSequence
        ? parseHeadersFromSequence({
              commonArgs,
              headersSequence: maybeHeadersSequence.value,
          })
        : {
              errors: collectedErrors,
              result: {
                  reason: getAbsenceReasonForField(
                      missingKeys,
                      FolderSettingsRequestSectionProperty.Headers,
                  ),
              },
          };

    const maybeAuthScalar = validStringScalars.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Auth,
    );
    const maybeAuthMap = validMaps.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Auth,
    );
    const authMapOrScalar = maybeAuthScalar ?? maybeAuthMap?.value;
    const auth = authMapOrScalar
        ? parseAuthFromYamlMapOrScalar({
              commonArgs,
              authMapOrScalar,
          })
        : {
              errors: collectedErrors,
              result: {
                  reason: getAbsenceReasonForField(
                      missingKeys,
                      FolderSettingsRequestSectionProperty.Auth,
                  ),
              },
          };

    const maybeVariablesSequence = validSequences.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Variables,
    );
    const variables = maybeVariablesSequence
        ? parseVariablesFromYamlSequence(
              maybeVariablesSequence.value,
              commonArgs,
          )
        : {
              errors: collectedErrors,
              result: {
                  reason: getAbsenceReasonForField(
                      missingKeys,
                      FolderSettingsRequestSectionProperty.Variables,
                  ),
              },
          };

    const maybeScriptsSequence = validSequences.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Scripts,
    );
    const scripts = maybeScriptsSequence
        ? parseScriptsFromYamlSequence(maybeScriptsSequence.value, commonArgs)
        : {
              errors: collectedErrors,
              result: {
                  reason: getAbsenceReasonForField(
                      missingKeys,
                      FolderSettingsRequestSectionProperty.Scripts,
                  ),
              },
          };

    const maybeActionsSequence = validSequences.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Actions,
    );
    const actions = maybeActionsSequence
        ? parseActionsFromYamlSequence(maybeActionsSequence.value, commonArgs)
        : {
              errors: collectedErrors,
              result: {
                  reason: getAbsenceReasonForField(
                      missingKeys,
                      FolderSettingsRequestSectionProperty.Actions,
                  ),
              },
          };

    return {
        headers,
        auth,
        variables,
        scripts,
        actions,
    };
}

function getAbsenceReasonForField(
    allMissingKeys: string[],
    keyToCheck: string,
) {
    return allMissingKeys.includes(keyToCheck)
        ? ReasonForFieldAbsence.Missing
        : ReasonForFieldAbsence.Invalid;
}
