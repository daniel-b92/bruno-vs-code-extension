import { YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedRequestVariable,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getValueFieldFromVariable } from "./getValueFieldFromVariable";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { RequestVariableProperty } from "./constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseVariablesFromYamlSequence(
    variablesSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<{
    enabled: ParsedRequestVariable[];
    disabled: ParsedRequestVariable[];
}> {
    const enabledVariables: ParsedRequestVariable[] = [];
    const disabledVariables: ParsedRequestVariable[] = [];
    const errors: YamlParsingError[] = [];

    const { items: variableMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: variablesSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = [
        RequestVariableProperty.Description,
        RequestVariableProperty.Name,
    ];
    const keysForBooleanScalars = [RequestVariableProperty.Disabled];

    for (const currentMap of variableMaps) {
        const {
            items: {
                unknownKeys,
                missingKeys,
                validScalars: {
                    withStringValue: validStringScalars,
                    withBooleanValue: validBooleanScalars,
                },
            },
            errors: mapItemErrors,
        } = getMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                },
            },
            commonArgs,
        );
        const allAllowedKeys = Object.values(RequestVariableProperty);
        const missingKeysWithContext = missingKeys.map((key) => ({
            key,
            isMandatory: key == RequestVariableProperty.Name,
        }));

        errors.push(
            ...mapItemErrors.concat(
                unknownKeys
                    .filter(
                        ({ key }) =>
                            !(allAllowedKeys as string[]).includes(key),
                    )
                    .map(({ key, keyRange }) =>
                        getErrorForUnknownKeyInMap({
                            ...commonArgs,
                            unknownKey: key,
                            keyRange,
                            allowedKeys: allAllowedKeys,
                        }),
                    ),
                missingKeysWithContext
                    .filter(({ isMandatory }) => isMandatory)
                    .map(({ key }) =>
                        getErrorForMissingKeyInMap({
                            ...commonArgs,
                            map: currentMap,
                            missingKey: key,
                        }),
                    ),
            ),
        );
        const missingProperties = missingKeysWithContext.map(
            ({ key, isMandatory }) => ({
                key,
                hasScalarValue: true,
                isMandatory,
            }),
        );
        const { description, disabled } =
            getItemsForSimpleOptionalVariableProps(
                validStringScalars,
                validBooleanScalars,
            );

        const { result: maybeValue, errors: valueErrors } =
            getValueFieldFromVariable(currentMap, commonArgs);
        errors.push(...valueErrors);

        const name = validStringScalars.find(
            ({ key }) => key == RequestVariableProperty.Name,
        );

        const variable: ParsedRequestVariable = {
            valueRange: getRangeForItem(currentMap, commonArgs),
            missingProperties,
            properties: {
                name: name ? stripKeyFromResult(name) : undefined,
                description,
                disabled,
                value: maybeValue,
            },
        };

        if (variable.properties.disabled.effectiveValue) {
            disabledVariables.push(variable);
        } else {
            enabledVariables.push(variable);
        }
    }

    return {
        result: {
            enabled: enabledVariables,
            disabled: disabledVariables,
        },
        errors,
    };
}

function getItemsForSimpleOptionalVariableProps(
    validStringScalars: WithKeyKeyRangeAndValueRange<string>[],
    validBooleanScalars: WithKeyKeyRangeAndValueRange<boolean>[],
) {
    const maybeDescriptionWithKeyRange = validStringScalars.find(
        ({ key }) => key == RequestVariableProperty.Description,
    );
    const maybeDisabledWithKeyRange = validBooleanScalars.find(
        ({ key }) => key == RequestVariableProperty.Disabled,
    );
    // The default value for 'disabled' is false, when not defined.
    const disabledEffectiveValue =
        maybeDisabledWithKeyRange !== undefined
            ? maybeDisabledWithKeyRange.value
            : false;

    return {
        description: maybeDescriptionWithKeyRange
            ? stripKeyFromResult(maybeDescriptionWithKeyRange)
            : undefined,
        disabled: {
            effectiveValue: disabledEffectiveValue,
            field: maybeDisabledWithKeyRange
                ? stripKeyFromResult(maybeDisabledWithKeyRange)
                : undefined,
        },
    };
}
