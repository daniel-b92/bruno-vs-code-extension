import { YAMLMap } from "yaml";
import { WithKeyAndValueRange, YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedDocsWithType,
    ParsedYamlMap,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import {
    DocsProperty,
    DocsType,
} from "../../../external/yamlFormat/constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseDocsFromYamlMap(
    docsMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedDocsWithType> {
    const { keyRange, value: map } = docsMap;

    const { errors, result: value } = parseFromMap(map, commonArgs);
    return {
        result: value
            ? { keyRange, value, valueRange: getRangeForItem(map, commonArgs) }
            : undefined,
        errors,
    };
}

function parseFromMap(
    docsMap: YAMLMap,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    ParsedYamlMap<{
        type?: WithKeyAndValueRange<DocsType>;
        content?: WithKeyAndValueRange<string>;
    }>
> {
    const errors: YamlParsingError[] = [];
    const { getString, missingProperties } = getValidatedMapItems(
        docsMap,
        {
            scalars: { stringValues: Object.values(DocsProperty) },
            mandatoryKeys: Object.values(DocsProperty),
        },
        commonArgs,
        errors,
    );
    const content = getString(DocsProperty.Content);
    const untypedType = getString(DocsProperty.Type);
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
        result: {
            properties: {
                content: stripKeyFromResult(content),
                type: maybeType?.value,
            },
            missingProperties,
        },
    };
}
