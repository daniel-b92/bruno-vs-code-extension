import {
    BrunoFileType,
    ParsedFolderSettingsFile,
    ParsedInfoForFolderSettings,
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
    const infoMap = validMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Info,
    );
    if (!infoMap || missingKeys.includes(TopLevelFolderSettingsProperty.Info)) {
        // The info property is the only mandatory one.
        return collectedErrors.concat(
            getErrorForMissingKeyInMap({
                ...commonArgs,
                missingKey: TopLevelFolderSettingsProperty.Info,
                map: topLevelMap,
            }),
        );
    }
    const info = getParsedInfo(infoMap, commonArgs, collectedErrors);
    if (!info) {
        // The info field is the only mandatory one.
        return collectedErrors;
    }
    const request = getParsedRequest(validMaps, commonArgs, collectedErrors);
    const docs = getParsedDocs(
        validMaps,
        validScalars,
        commonArgs,
        collectedErrors,
    );
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
    allValidMaps: WithKeyAndKeyRange<YAMLMap>[],
    allValidScalars: WithKeyKeyRangeAndValueRange<unknown>[],
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedDocsWithType | undefined {
    const map = allValidMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Docs,
    );
    const untypedScalar = allValidScalars.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Docs,
    );
    if ((map && untypedScalar) || (!map && !untypedScalar)) {
        return undefined;
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
        return undefined;
    }

    const docs = (map?.value ??
        (untypedScalar as
            | WithKeyKeyRangeAndValueRange<null>
            | WithKeyKeyRangeAndValueRange<string>
            | undefined))!;

    const parsingResult = parseDocsFromYamlMapOrScalar(docs, commonArgs);
    const { result, errors: parsingErrors } = parsingResult;
    collectedErrors.push(...parsingErrors);

    return result;
}

function getParsedRequest(
    validSecondLevelMaps: WithKeyAndKeyRange<YAMLMap>[],
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const requestMap = validSecondLevelMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Request,
    );

    if (!requestMap) {
        return undefined;
    }
    const {
        auth: parsedAuth,
        headers: parsedHeaders,
        variables: parsedVariables,
        scripts: parsedScripts,
        actions: parsedActions,
    } = parseRequestSection(requestMap.value, commonArgs);
    const { result: auth, errors: authErrors } = parsedAuth ?? {
        result: undefined,
        errors: [],
    };
    const { result: headers, errors: headerErrors } = parsedHeaders ?? {
        result: undefined,
        errors: [],
    };
    const { result: variables, errors: variableErrors } = parsedVariables ?? {
        result: undefined,
        errors: [],
    };
    const { result: scripts, errors: scriptErrors } = parsedScripts ?? {
        result: undefined,
        errors: [],
    };
    const { result: actions, errors: actionsErrors } = parsedActions ?? {
        result: undefined,
        errors: [],
    };
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
        : undefined;

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
        : undefined;

    const maybeVariablesSequence = validSequences.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Variables,
    );
    const variables = maybeVariablesSequence
        ? parseVariablesFromYamlSequence(
              maybeVariablesSequence.value,
              commonArgs,
          )
        : undefined;

    const maybeScriptsSequence = validSequences.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Scripts,
    );
    const scripts = maybeScriptsSequence
        ? parseScriptsFromYamlSequence(maybeScriptsSequence.value, commonArgs)
        : undefined;

    const maybeActionsSequence = validSequences.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Actions,
    );
    const actions = maybeActionsSequence
        ? parseActionsFromYamlSequence(maybeActionsSequence.value, commonArgs)
        : undefined;

    return {
        headers,
        auth,
        variables,
        scripts,
        actions,
    };
}
