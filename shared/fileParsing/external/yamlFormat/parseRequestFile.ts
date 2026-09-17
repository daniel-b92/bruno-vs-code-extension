import { YAMLMap } from "yaml";
import {
    BrunoFileType,
    ParsedInfoForRequestFile,
    ParsedRequestFile,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedRequestFileAppSection,
    WithKeyAndKeyRange,
} from "../../internal/yamlFormat/interfaces";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import {
    RequestFileAppProperty,
    RequestFileRuntimeProperty,
    TopLevelRequestFileProperty,
} from "./constants/requestFileConstants";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { parseSettingsFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseSettingsFromYamlMap";
import { stripKeyFromResult } from "../../internal/yamlFormat/util/stripKeyFromResult";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";
import { parseVariablesFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseVariablesFromYamlSequence";
import { parseScriptsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseScriptsFromYamlSequence";
import { parseActionsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseActionsFromYamlSequence";
import { parseAssertionsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseAssertionsFromYamlSequence";

export function parseRequestFile(
    docHelper: TextDocumentHelper,
): MaybeResultWithErrors<ParsedRequestFile> {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];
    const expectedTopLevelProperties = Object.values(
        TopLevelRequestFileProperty,
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
            validScalars: { withStringValue: validStringScalars },
        },
        errors: mapItemErrors,
    } = getMapItems(
        topLevelMap,
        {
            // Docs section is always a scalar for request files.
            scalars: { stringValues: [TopLevelRequestFileProperty.Docs] },
            mapValues: expectedTopLevelProperties.filter(
                (prop) => prop != TopLevelRequestFileProperty.Docs,
            ),
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
            // info is the only mandatory top level property.
            missingKeys.includes(TopLevelRequestFileProperty.Info)
                ? getErrorForMissingKeyInMap({
                      ...commonArgs,
                      missingKey: TopLevelRequestFileProperty.Info,
                      map: topLevelMap,
                  })
                : [],
        ),
    );

    const missingProperties = missingKeys.map((key) => ({
        key,
        alwaysHasScalarValue: key == TopLevelRequestFileProperty.Docs,
        isMandatory: key == TopLevelRequestFileProperty.Info,
    }));

    const infoMap = validMaps.find(
        ({ key }) => key == TopLevelRequestFileProperty.Info,
    );
    const info = infoMap
        ? getParsedInfo(infoMap, commonArgs, collectedErrors)
        : undefined;
    const runtimeMap = validMaps.find(
        ({ key }) => key == TopLevelRequestFileProperty.Runtime,
    );
    const runtime = runtimeMap
        ? getParsedRuntime(runtimeMap, commonArgs, collectedErrors)
        : undefined;
    const docsWithKey = validStringScalars.find(
        ({ key }) => key == TopLevelRequestFileProperty.Docs,
    );
    const docs = docsWithKey ? stripKeyFromResult(docsWithKey) : undefined;
    const settingsMap = validMaps.find(
        ({ key }) => key == TopLevelRequestFileProperty.Settings,
    );
    const settings = settingsMap
        ? getParsedSettings(settingsMap, commonArgs, collectedErrors)
        : undefined;
    const appMap = validMaps.find(
        ({ key }) => key == TopLevelRequestFileProperty.App,
    );
    const app = appMap
        ? getParsedApp(appMap, commonArgs, collectedErrors)
        : undefined;

    return {
        errors: collectedErrors,
        result: {
            properties: { info, runtime, docs, settings, app },
            missingProperties,
        },
    };
}

function getParsedInfo(
    infoMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedInfoForRequestFile | undefined {
    const { result: info, errors } = parseFileInfoFromYamlMap({
        infoMap,
        commonArgs,
        fileType: BrunoFileType.RequestFile,
    });
    collectedErrors.push(...errors);

    return info;
}

function getParsedSettings(
    settingsMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const { result: settings, errors } = parseSettingsFromYamlMap(
        settingsMap,
        commonArgs,
    );
    collectedErrors.push(...errors);

    return settings;
}

function getParsedApp(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedRequestFileAppSection {
    const expectedBooleanScalars = [RequestFileAppProperty.Enabled];
    const expectedStringScalars = [RequestFileAppProperty.Code];

    const {
        errors: mapItemErrors,
        items: {
            unknownKeys,
            missingKeys,
            validScalars: {
                withStringValue: validStringScalars,
                withBooleanValue: validBooleanScalars,
            },
        },
    } = getMapItems(
        map,
        {
            scalars: {
                stringValues: expectedStringScalars,
                booleanValues: expectedBooleanScalars,
            },
        },
        commonArgs,
    );

    const errors = mapItemErrors.concat(
        unknownKeys.map(
            ({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    allowedKeys: Object.values(RequestFileAppProperty),
                    keyRange,
                    unknownKey: key,
                }),
            missingKeys.map((key) =>
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    map,
                    missingKey: key,
                }),
            ),
        ),
    );
    const missingProperties = missingKeys.map((key) => ({
        key,
        alwaysHasScalarValue: true,
        isMandatory: true,
    }));

    collectedErrors.push(...errors);
    const maybeCode = validStringScalars.find(
        ({ key }) => key == RequestFileAppProperty.Code,
    );
    const maybeEnabled = validBooleanScalars.find(
        ({ key }) => key == RequestFileAppProperty.Enabled,
    );

    return {
        missingProperties,
        keyRange,
        valueRange: getRangeForItem(map, commonArgs),
        properties: {
            code: maybeCode ? stripKeyFromResult(maybeCode) : undefined,
            enabled: maybeEnabled
                ? stripKeyFromResult(maybeEnabled)
                : undefined,
        },
    };
}

function getParsedRuntime(
    { keyRange, value: yamlMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const {
        missingProperties,
        properties: {
            variables: parsedVariables,
            scripts: parsedScripts,
            assertions: parsedAssertions,
            actions: parsedActions,
        },
    } = parseRuntimeSection(yamlMap, commonArgs, collectedErrors);
    const { result: variables, errors: variableErrors } = parsedVariables ?? {
        result: undefined,
        errors: [],
    };
    const { result: scripts, errors: scriptErrors } = parsedScripts ?? {
        result: undefined,
        errors: [],
    };
    const { result: assertions, errors: assertionsErrors } =
        parsedAssertions ?? {
            result: undefined,
            errors: [],
        };
    const { result: actions, errors: actionsErrors } = parsedActions ?? {
        result: undefined,
        errors: [],
    };
    collectedErrors.push(
        ...variableErrors,
        ...scriptErrors,
        ...assertionsErrors,
        ...actionsErrors,
    );

    return {
        properties: { variables, scripts, assertions, actions },
        missingProperties,
        keyRange,
        valueRange: getRangeForItem(yamlMap, commonArgs),
    };
}

function parseRuntimeSection(
    requestMap: YAMLMap,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const expectedProperties = Object.values(RequestFileRuntimeProperty);

    const {
        items: { unknownKeys, missingKeys, validSequences },
        errors: sectionErrors,
    } = getMapItems(
        requestMap,
        {
            scalars: {},
            // All properties are sequences for the runtime section.
            sequenceValues: expectedProperties,
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
                    allowedKeys: expectedProperties,
                }),
            ),
        ),
    );
    const missingProperties = missingKeys.map((key) => ({
        alwaysHasScalarValue: false,
        // None of the properties are mandatory.
        isMandatory: false,
        key,
    }));

    const maybeVariablesSequence = validSequences.find(
        ({ key }) => key == RequestFileRuntimeProperty.Variables,
    );
    const variables = maybeVariablesSequence
        ? parseVariablesFromYamlSequence(
              maybeVariablesSequence.value,
              commonArgs,
          )
        : undefined;
    const maybeScriptsSequence = validSequences.find(
        ({ key }) => key == RequestFileRuntimeProperty.Scripts,
    );
    const scripts = maybeScriptsSequence
        ? parseScriptsFromYamlSequence(maybeScriptsSequence.value, commonArgs)
        : undefined;
    const maybeAssertionsSequence = validSequences.find(
        ({ key }) => key == RequestFileRuntimeProperty.Assertions,
    );
    const assertions = maybeAssertionsSequence
        ? parseAssertionsFromYamlSequence(
              maybeAssertionsSequence.value,
              commonArgs,
          )
        : undefined;
    const maybeActionsSequence = validSequences.find(
        ({ key }) => key == RequestFileRuntimeProperty.Actions,
    );
    const actions = maybeActionsSequence
        ? parseActionsFromYamlSequence(maybeActionsSequence.value, commonArgs)
        : undefined;

    return {
        missingProperties,
        properties: {
            variables,
            scripts,
            assertions,
            actions,
        },
    };
}
