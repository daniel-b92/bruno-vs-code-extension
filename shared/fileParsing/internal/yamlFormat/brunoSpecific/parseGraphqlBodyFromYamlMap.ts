import { isScalar, Scalar, YAMLMap } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedGraphqlBody,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getRangeForItem } from "../util/getRangeForItem";
import { RequestFileGraphqlSectionBodyProperty } from "../../../external/yamlFormat/constants/requestFileConstants";

export function parseGraphqlBodyFromYamlMap(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedGraphqlBody> {
    const errors: YamlParsingError[] = [];

    const { getString, missingProperties } = getValidatedMapItems(
        map,
        {
            scalars: {
                stringValues: Object.values(
                    RequestFileGraphqlSectionBodyProperty,
                ),
            },
        },
        commonArgs,
        errors,
    );

    const rawVariables = getString(
        RequestFileGraphqlSectionBodyProperty.Variables,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            missingProperties,
            properties: {
                query: stripKeyFromResult(
                    getString(RequestFileGraphqlSectionBodyProperty.Query),
                ),
                variables: rawVariables && {
                    ...stripKeyFromResult(rawVariables),
                    isLiteralBlockScalar: isLiteralBlockScalar(
                        map.get(
                            RequestFileGraphqlSectionBodyProperty.Variables,
                            true,
                        ),
                    ),
                },
            },
        },
    };
}

function isLiteralBlockScalar(node: unknown) {
    return isScalar(node) && node.type == Scalar.BLOCK_LITERAL;
}
