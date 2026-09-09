import { YAMLMap } from "yaml";
import {
    BrunoFileType,
    ParsedInfoForRequestFile,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    WithKeyAndKeyRange,
} from "../../internal/yamlFormat/interfaces";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { TopLevelRequestFileProperty } from "./constants/requestFileConstants";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { parseSettingsFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseSettingsFromYamlMap";
import { stripKeyFromResult } from "../../internal/yamlFormat/util/stripKeyFromResult";

export function parseRequestFile(docHelper: TextDocumentHelper) {
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
    const docsWithKey = validStringScalars.find(
        ({ key }) => key == TopLevelRequestFileProperty.Docs,
    );
    const docs = docsWithKey ? stripKeyFromResult(docsWithKey) : undefined;
    const settingsMap = validMaps.find(
        ({ key }) => key == TopLevelRequestFileProperty.settings,
    );
    const settings = settingsMap
        ? getParsedSettings(settingsMap, commonArgs, collectedErrors)
        : undefined;

    return {
        errors: collectedErrors,
        result: { properties: { info, docs, settings }, missingProperties },
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
