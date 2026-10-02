import { YAMLMap } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedHttpBody,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
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
            validScalars: { withStringValue: validStrings },
        },
        missingProperties,
    } = getValidatedMapItems(
        map,
        { scalars: { stringValues: expectedStringScalars } },
        commonArgs,
        errors,
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
