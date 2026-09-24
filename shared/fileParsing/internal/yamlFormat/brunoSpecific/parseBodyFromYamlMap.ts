import { YAMLMap } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedHttpBody,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getMapItems } from "../yamlMaps/getMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getRangeForItem } from "../util/getRangeForItem";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import {
    HttpBodyType,
    RequestFileHttpSectionBodyProperty,
} from "../../../external/yamlFormat/constants/requestFileConstants";

export function parseBodyFromYamlMap(
    bodyMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedHttpBody> {
    const { keyRange, value: map } = bodyMap;
    const errors: YamlParsingError[] = [];

    const expectedStringScalars = [
        RequestFileHttpSectionBodyProperty.Type,
        RequestFileHttpSectionBodyProperty.Data,
    ];

    const {
        items: {
            unknownKeys,
            validScalars: { withStringValue: validStrings },
            missingKeys,
        },
        errors: mapItemErrors,
    } = getMapItems(
        map,
        {
            scalars: { stringValues: expectedStringScalars },
        },
        commonArgs,
    );

    errors.push(
        ...mapItemErrors,
        ...unknownKeys.map(({ key: unknownKey, keyRange: ukr }) =>
            getErrorForUnknownKeyInMap({
                ...commonArgs,
                unknownKey,
                keyRange: ukr,
                allowedKeys: expectedStringScalars,
            }),
        ),
    );

    const parsedType = getTypedValueFromList<HttpBodyType>(
        {
            allStringValues: validStrings,
            keyName: RequestFileHttpSectionBodyProperty.Type,
            allowedValues: Object.values(HttpBodyType),
        },
        errors,
    )?.value;

    const rawData = validStrings.find(
        ({ key }) => key == RequestFileHttpSectionBodyProperty.Data,
    );

    const missingProperties = missingKeys.map((key) => ({
        key,
        alwaysHasScalarValue: true,
        isMandatory: false,
    }));

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            missingProperties,
            properties: {
                type: parsedType,
                data: rawData ? stripKeyFromResult(rawData) : undefined,
            },
        },
    };
}
