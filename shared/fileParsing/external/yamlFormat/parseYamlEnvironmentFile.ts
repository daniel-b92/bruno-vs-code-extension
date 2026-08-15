import { isScalar, YAMLMap } from "yaml";
import {
    ParsedEnvironmentVariable,
    TextDocumentHelper,
    WithKeyAndValueRange,
    YamlParsingError,
} from "../../..";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import {
    CommonParsingArgs,
    EnvironmentVariableProperty,
    ParsedMapItems,
    ParsingResult,
    VariableType,
} from "../../internal/yamlFormat/interfaces";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { mapFromYamlScalar } from "../../internal/yamlFormat/scalars/mapFromYamlScalar";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getTypedValueFromList } from "../../internal/yamlFormat/scalars/getTypedValueFromList";
import { stripKeyFromResult } from "../../internal/yamlFormat/util/stripKeyFromResult";
import { getValueFieldFromVariable } from "../../internal/yamlFormat/brunoSpecific/getValueFieldFromVariable";

enum EnvironmentKeyName {
    Name = "name",
    Variables = "variables",
}

export function parseYamlEnvironmentFile(
    docHelper: TextDocumentHelper,
): ParsingResult<{
    name: WithKeyAndValueRange<string> | { missing: boolean };
    variables: ParsedEnvironmentVariable[];
}> {
    const fullDocumentRange = docHelper.getTextRange();
    const commonArgs = { docHelper, fullDocumentRange };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap.errors;
    }
    const topLevelMap = maybeTopLevelMap.map;

    const keysForStringScalars = [EnvironmentKeyName.Name];
    const keysForSequences = [EnvironmentKeyName.Variables];

    const { items: mapItems, errors: mapItemErrors } = getMapItems(
        topLevelMap,
        {
            scalars: { stringValues: keysForStringScalars },
            sequenceValues: keysForSequences,
        },
        commonArgs,
    );

    collectedErrors.push(
        ...mapItemErrors.concat(
            mapItems.unknownKeys.map(({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey: key,
                    keyRange,
                    allowedKeys: keysForStringScalars.concat(keysForSequences),
                }),
            ),
        ),
    );

    const {
        validScalars: { withStringValue: validStringScalars },
        validSequences,
        missingKeys,
    } = mapItems;

    const maybeNameWithKeyRange = validStringScalars.find(
        ({ key }) => key == EnvironmentKeyName.Name,
    );
    const nameToUse: WithKeyAndValueRange<string> | { missing: boolean } =
        maybeNameWithKeyRange
            ? stripKeyFromResult(maybeNameWithKeyRange)
            : {
                  missing: missingKeys.includes(EnvironmentKeyName.Name),
              };

    const variablesSequence = validSequences.find(
        ({ key }) => key == EnvironmentKeyName.Variables,
    )?.value;

    if (!variablesSequence) {
        // For further steps, the variables sequence needs to be valid.
        return collectedErrors;
    }

    const { items: variableItems, errors: firstErrorBatch } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: variablesSequence,
        });

    const { variables, errors: secondErrorBatch } = getVariablesFromMapItems(
        variableItems,
        commonArgs,
    );

    return {
        result: {
            name: nameToUse,
            variables,
        },
        errors: collectedErrors.concat(firstErrorBatch, secondErrorBatch),
    };
}

function getVariablesFromMapItems(
    items: YAMLMap[],
    commonArgs: CommonParsingArgs,
): { variables: ParsedEnvironmentVariable[]; errors: YamlParsingError[] } {
    const variables: ParsedEnvironmentVariable[] = [];
    const errors: YamlParsingError[] = [];

    const keysForStringScalars = [
        EnvironmentVariableProperty.Description,
        EnvironmentVariableProperty.Name,
        EnvironmentVariableProperty.Type,
    ];
    const keysForBooleanScalars = [
        EnvironmentVariableProperty.Disabled,
        EnvironmentVariableProperty.Secret,
    ];

    for (const currentMap of items) {
        const { items: allMapItems, errors: mapItemErrors } = getMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                },
                sequenceValues: [],
            },
            commonArgs,
        );

        errors.push(
            ...mapItemErrors.concat(
                allMapItems.unknownKeys
                    .filter(
                        ({ key }) =>
                            !(
                                Object.values(
                                    EnvironmentVariableProperty,
                                ) as string[]
                            ).includes(key),
                    )
                    .map(({ key, keyRange }) =>
                        getErrorForUnknownKeyInMap({
                            ...commonArgs,
                            unknownKey: key,
                            keyRange,
                            allowedKeys: keysForStringScalars.concat(
                                keysForBooleanScalars,
                            ),
                        }),
                    ),
            ),
        );
        const { description, disabled, secret } =
            getItemsForSimpleOptionalVariableProps(allMapItems);

        const type = getTypedValueFromList(
            {
                allStringValues: allMapItems.validScalars.withStringValue,
                allowedValues: Object.values(VariableType),
                keyName: EnvironmentVariableProperty.Type,
            },
            errors,
        );
        const maybeValue = getValueFieldFromVariable(currentMap, commonArgs);
        if (maybeValue && "errors" in maybeValue) {
            errors.push(...maybeValue.errors);
        }

        const valueToUse =
            maybeValue && !("errors" in maybeValue) ? maybeValue : undefined;

        const name = allMapItems.validScalars.withStringValue.find(
            ({ key }) => key == EnvironmentVariableProperty.Name,
        );

        if (!name) {
            // The 'name' field is the only one that always has to be present.
            errors.push(
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    missingKey: EnvironmentVariableProperty.Name,
                    map: currentMap,
                }),
            );
            continue;
        }

        variables.push({
            range: getRangeForItem(currentMap, commonArgs),
            missingProperties:
                allMapItems.missingKeys as EnvironmentVariableProperty[],
            fields: {
                name: stripKeyFromResult(name),
                description: description
                    ? stripKeyFromResult(description)
                    : undefined,
                disabled: disabled
                    ? {
                          effectiveValue: disabled.value,
                          field: stripKeyFromResult(disabled),
                      }
                    : // The default value for 'disabled' is false, when not defined.
                      { effectiveValue: false },
                secret: secret
                    ? {
                          effectiveValue: secret.value,
                          field: stripKeyFromResult(secret),
                      }
                    : // The default value for 'secret' is false, when not defined.
                      { effectiveValue: false },
                value: !valueToUse
                    ? undefined
                    : isScalar<string>(valueToUse.value)
                      ? mapFromYamlScalar({
                            ...commonArgs,
                            keyRange: valueToUse.keyRange,
                            value: valueToUse.value,
                        })
                      : {
                            ...valueToUse,
                            ...valueToUse.value,
                        },
                type: type
                    ? {
                          effectiveValue: type.value.value,
                          field: type.value,
                      }
                    : // The default value for 'type' is 'string', when not defined.
                      { effectiveValue: VariableType.String },
            },
        });
    }

    return { variables, errors };
}

function getItemsForSimpleOptionalVariableProps(allMapItems: ParsedMapItems) {
    const maybeDescriptionWithKeyRange =
        allMapItems.validScalars.withStringValue.find(
            ({ key }) => key == EnvironmentVariableProperty.Description,
        );

    const maybeDisabledWithKeyRange =
        allMapItems.validScalars.withBooleanValue.find(
            ({ key }) => key == EnvironmentVariableProperty.Disabled,
        );

    const maybeSecretWithKeyRange =
        allMapItems.validScalars.withBooleanValue.find(
            ({ key }) => key == EnvironmentVariableProperty.Secret,
        );

    return {
        description: maybeDescriptionWithKeyRange,
        disabled: maybeDisabledWithKeyRange,
        secret: maybeSecretWithKeyRange,
    };
}
