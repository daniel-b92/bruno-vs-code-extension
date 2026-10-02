import {
    BrunoFileType,
    ParsedFolderSettingsFile,
    ParsedInfoForFolderSettings,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedDocsWithType,
    WithKeyAndKeyRange,
} from "../../internal/yamlFormat/interfaces";
import { getValidatedMapItems } from "../../internal/yamlFormat/yamlMaps/getValidatedMapItems";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
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
import { parseDocsFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseDocsFromYamlMap";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";

export function parseFolderSettingsFile(
    docHelper: TextDocumentHelper,
): MaybeResultWithErrors<ParsedFolderSettingsFile> {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap;
    }

    const {
        items: { validMaps },
        missingProperties,
    } = getValidatedMapItems(
        maybeTopLevelMap.map,
        {
            // Docs section is always a Yaml map for folder settings files.
            mapValues: Object.values(TopLevelFolderSettingsProperty),
            mandatoryKeys: [TopLevelFolderSettingsProperty.Info],
        },
        commonArgs,
        collectedErrors,
    );

    const infoMap = validMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Info,
    );
    const info = infoMap
        ? getParsedInfo(infoMap, commonArgs, collectedErrors)
        : undefined;
    const request = getParsedRequest(validMaps, commonArgs, collectedErrors);
    const docs = getParsedDocs(validMaps, commonArgs, collectedErrors);
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
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedDocsWithType | undefined {
    const map = allValidMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Docs,
    );
    if (!map) {
        return undefined;
    }

    const parsingResult = parseDocsFromYamlMap(map, commonArgs);
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
    const {
        items: { validMaps, validSequences, validScalars },
        missingProperties,
    } = getValidatedMapItems(
        requestMap,
        {
            // Auth can either be a Scalar string with the value 'inherit' or a map with a specific type.
            scalars: {
                stringValues: [FolderSettingsRequestSectionProperty.Auth],
            },
            mapValues: [FolderSettingsRequestSectionProperty.Auth],
            sequenceValues: [
                FolderSettingsRequestSectionProperty.Headers,
                FolderSettingsRequestSectionProperty.Variables,
                FolderSettingsRequestSectionProperty.Scripts,
                FolderSettingsRequestSectionProperty.Actions,
            ],
            // None of the properties are mandatory.
        },
        commonArgs,
        collectedErrors,
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

    const maybeAuthScalar = validScalars.withStringValue.find(
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
