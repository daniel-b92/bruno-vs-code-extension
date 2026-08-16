import { isMap, YAMLMap } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    ParsedDocsWithType,
    ParsingResult,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getMapItems } from "../yamlMaps/getMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { DocsProperty, DocsType } from "./constants/sharedConstants";

export function parseDocsFromYamlMapOrScalar(
    docsMapOrScalar:
        | YAMLMap
        | WithKeyKeyRangeAndValueRange<string>
        | WithKeyKeyRangeAndValueRange<null>,
    commonArgs: CommonParsingArgs,
): ParsingResult<ParsedDocsWithType> {
    if (!isMap(docsMapOrScalar)) {
        const { value } = docsMapOrScalar;
        return value === null
            ? { errors: [], result: {} }
            : {
                  errors: [],
                  result: { content: stripKeyFromResult(docsMapOrScalar) },
              };
    }

    return parseFromMap(docsMapOrScalar, commonArgs);
}

function parseFromMap(
    docsMap: YAMLMap,
    commonArgs: CommonParsingArgs,
): ParsingResult<ParsedDocsWithType> {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = Object.values(DocsProperty);

    const {
        items: {
            missingKeys,
            unknownKeys,
            validScalars: { withStringValue: validStringScalars },
        },
        errors: mapItemErrors,
    } = getMapItems(
        docsMap,
        {
            scalars: {
                stringValues: expectedStringScalars,
            },
        },
        commonArgs,
    );

    errors.push(
        ...mapItemErrors,
        ...unknownKeys.map(({ key: unknownKey, keyRange }) =>
            getErrorForUnknownKeyInMap({
                ...commonArgs,
                unknownKey,
                keyRange,
                allowedKeys: expectedStringScalars,
            }),
        ),
        ...missingKeys.map((key) =>
            getErrorForMissingKeyInMap({
                ...commonArgs,
                missingKey: key,
                map: docsMap,
            }),
        ),
    );
    const content = validStringScalars.find(
        ({ key }) => key == DocsProperty.Content,
    );
    const untypedType = validStringScalars.find(
        ({ key }) => key == DocsProperty.Content,
    );
    if (!untypedType) {
        return errors;
    }
    const maybeType = getTypedValueFromList(
        {
            allowedValues: Object.values(DocsType),
            allStringValues: [untypedType],
            keyName: DocsProperty.Type,
        },
        errors,
    );

    return !content || !maybeType
        ? errors
        : { errors, result: { content, type: maybeType.value } };
}
