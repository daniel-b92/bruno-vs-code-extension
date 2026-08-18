import { isMap, YAMLMap } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedDocsWithType,
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
): MaybeResultWithErrors<ParsedDocsWithType> {
    if (!isMap(docsMapOrScalar)) {
        const { value } = docsMapOrScalar;
        return {
            errors: [],
            result:
                value === null
                    ? undefined
                    : stripKeyFromResult(docsMapOrScalar),
        };
    }

    return parseFromMap(docsMapOrScalar, commonArgs);
}

function parseFromMap(
    docsMap: YAMLMap,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedDocsWithType> {
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
    const missingProperties = missingKeys.map((key) => ({
        hasScalarValue: true,
        isMandatory: false,
        key,
    }));
    const content = validStringScalars.find(
        ({ key }) => key == DocsProperty.Content,
    );
    const untypedType = validStringScalars.find(
        ({ key }) => key == DocsProperty.Type,
    );
    const maybeType = !untypedType
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(DocsType),
                  allStringValues: [untypedType],
                  keyName: DocsProperty.Type,
              },
              errors,
          );

    return {
        errors,
        result:
            content || maybeType
                ? {
                      properties: { content, type: maybeType?.value },
                      missingProperties,
                  }
                : undefined,
    };
}
