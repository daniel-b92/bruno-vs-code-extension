import { YAMLMap } from "yaml";
import {
    BrunoFileType,
    ParsedInfoForRequestFile,
    TextDocumentHelper,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../..";
import {
    CommonParsingArgs,
    ParsedDocsWithType,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../../internal/yamlFormat/interfaces";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { TopLevelRequestFileProperty } from "./constants/requestFileConstants";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { parseDocsFromYamlMapOrScalar } from "../../internal/yamlFormat/brunoSpecific/parseDocsFromYamlMapOrScalar";

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
            validScalars: { withStringValue: validScalars },
        },
        errors: mapItemErrors,
    } = getMapItems(
        topLevelMap,
        {
            // Docs section can either be a scalar or a map.
            scalars: { stringValues: [TopLevelRequestFileProperty.Docs] },
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

    // Docs section was searched for as both a scalar and a map. So only, if it is not found for both, it is really missing.
    const isDocsSectionMissing =
        missingKeys.filter((key) => key == TopLevelRequestFileProperty.Docs)
            .length > 1;
    const missingProperties = missingKeys
        .filter((key) => key != TopLevelRequestFileProperty.Docs)
        .concat(isDocsSectionMissing ? TopLevelRequestFileProperty.Docs : [])
        .map((key) => ({
            key,
            alwaysHasScalarValue: false,
            isMandatory: key == TopLevelRequestFileProperty.Info,
        }));

    const infoMap = validMaps.find(
        ({ key }) => key == TopLevelRequestFileProperty.Info,
    );
    const info = infoMap
        ? getParsedInfo(infoMap, commonArgs, collectedErrors)
        : undefined;
    const docs = getParsedDocs(
        validMaps,
        validScalars,
        commonArgs,
        collectedErrors,
    );

    return {
        errors: collectedErrors,
        result: { properties: { info, docs }, missingProperties },
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

function getParsedDocs(
    allValidMaps: WithKeyAndKeyRange<YAMLMap>[],
    allValidScalars: WithKeyKeyRangeAndValueRange<unknown>[],
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedDocsWithType | undefined {
    const map = allValidMaps.find(
        ({ key }) => key == TopLevelRequestFileProperty.Docs,
    );
    const untypedScalar = allValidScalars.find(
        ({ key }) => key == TopLevelRequestFileProperty.Docs,
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
