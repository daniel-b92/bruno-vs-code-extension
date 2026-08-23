import {
    BrunoFileType,
    ParsedFolderSettingsFile,
    ParsedInfoForFolderSettings,
    TextDocumentHelper,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedDocsWithType,
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
} from "./constants/folderSettingsFileConstants";
import { parseDocsFromYamlMapOrScalar } from "../../internal/yamlFormat/brunoSpecific/parseDocsFromYamlMapOrScalar";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";

export function parseFolderSettingsFile(
    docHelper: TextDocumentHelper,
): MaybeResultWithErrors<ParsedFolderSettingsFile> {
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
        return maybeTopLevelMap;
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
            missingKeys.includes(TopLevelFolderSettingsProperty.Info)
                ? getErrorForMissingKeyInMap({
                      ...commonArgs,
                      missingKey: TopLevelFolderSettingsProperty.Info,
                      map: topLevelMap,
                  })
                : [],
        ),
    );
    // Docs section was searched for as both a scalar and a map. So only, if it is not found for both, it is really missing.
    const isDocsSectionMissing =
        missingKeys.filter((key) => key == TopLevelFolderSettingsProperty.Docs)
            .length > 1;
    const missingProperties = missingKeys
        .filter((key) => key != TopLevelFolderSettingsProperty.Docs)
        .concat(isDocsSectionMissing ? TopLevelFolderSettingsProperty.Docs : [])
        .map((key) => ({
            key,
            alwaysHasScalarValue: false,
            isMandatory: key == TopLevelFolderSettingsProperty.Info,
        }));
    const infoMap = validMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Info,
    );
    const info = infoMap
        ? getParsedInfo(infoMap, commonArgs, collectedErrors)
        : undefined;
    const request = getParsedRequest(validMaps, commonArgs, collectedErrors);
    const docs = getParsedDocs(
        validMaps,
        validScalars,
        commonArgs,
        collectedErrors,
    );
    return {
        errors: collectedErrors,
        result: { properties: { info, request, docs }, missingProperties },
    };
}

function getParsedInfo(
    infoMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedInfoForFolderSettings | undefined {
    const { result: info, errors } = parseFileInfoFromYamlMap({
        infoMap,
        commonArgs,
        fileType: BrunoFileType.FolderSettingsFile,
    });
    collectedErrors.push(...errors);

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

    const docs = (map ??
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
    const maybeRequestMap = validSecondLevelMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Request,
    );

    if (!maybeRequestMap) {
        return undefined;
    }
    const { keyRange, value: requestMap } = maybeRequestMap;
    const {
        missingProperties,
        properties: {
            auth: parsedAuth,
            headers: parsedHeaders,
            variables: parsedVariables,
            scripts: parsedScripts,
            actions: parsedActions,
        },
    } = parseRequestSection(maybeRequestMap.value, commonArgs, collectedErrors);
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

    return {
        properties: { auth, headers, variables, scripts, actions },
        missingProperties,
        keyRange,
        valueRange: getRangeForItem(requestMap, commonArgs),
    };
}

function parseRequestSection(
    requestMap: YAMLMap,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
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
            missingKeys,
            validMaps,
            validSequences,
            validScalars: { withStringValue: validStringScalars },
        },
        errors: sectionErrors,
    } = getMapItems(
        requestMap,
        {
            scalars: { stringValues: expectedScalarStrings },
            mapValues: expectedMaps,
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
    // Since we searched for the auth property as a scalar and as a map, it's only missing, if neither was found.
    const isAuthMissing =
        missingKeys.filter(
            (key) => key == FolderSettingsRequestSectionProperty.Auth,
        ).length > 1;
    const missingProperties = missingKeys
        .filter((key) => key != FolderSettingsRequestSectionProperty.Auth)
        .concat(isAuthMissing ? FolderSettingsRequestSectionProperty.Auth : [])
        .map((key) => ({
            alwaysHasScalarValue: false,
            // None of the properties are mandatory.
            isMandatory: false,
            key,
        }));

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
    const authMapOrScalar = maybeAuthScalar ?? maybeAuthMap;
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
        missingProperties,
        properties: {
            headers,
            auth,
            variables,
            scripts,
            actions,
        },
    };
}
