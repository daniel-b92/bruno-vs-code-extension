import { YAMLMap, YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedAction,
    ParsedYamlMapWithKeyAndValueRange,
    WithKeyAndKeyRange,
} from "../interfaces";
import { Range, WithKeyAndValueRange, YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import {
    ValidatedMapItems,
    getValidatedMapItems,
} from "../yamlMaps/getValidatedMapItems";
import { parseIfPresent } from "../util/parseIfPresent";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import {
    ActionPhase,
    ActionProperty,
    ActionSelectorMethod,
    ActionSelectorProperty,
    ActionType,
    ActionVariableProperty,
    ActionVariableScope,
} from "../../../external/yamlFormat/constants/actionConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseActionsFromYamlSequence(
    actionsSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<{
    enabled: ParsedAction[];
    disabled: ParsedAction[];
}> {
    const enabledActions: ParsedAction[] = [];
    const disabledActions: ParsedAction[] = [];
    const errors: YamlParsingError[] = [];

    const { items: actionsMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: actionsSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = [ActionProperty.Description];
    const keysForBooleanScalars = [ActionProperty.Disabled];
    const keysForMaps = [ActionProperty.Selector, ActionProperty.Variable];
    const optionalKeys: string[] = [
        ActionProperty.Description,
        ActionProperty.Disabled,
    ];

    for (const currentMap of actionsMaps) {
        const mapItems = getValidatedMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                    enumValues: {
                        [ActionProperty.Phase]: Object.values(ActionPhase),
                        [ActionProperty.Type]: Object.values(ActionType),
                    },
                },
                mapValues: keysForMaps,
                mandatoryKeys: Object.values(ActionProperty).filter(
                    (key) => !optionalKeys.includes(key),
                ),
            },
            commonArgs,
            errors,
        );
        const maybeAction = parseAction(
            getRangeForItem(currentMap, commonArgs),
            mapItems,
            commonArgs,
        );
        const { errors: actionErrors, result: action } = maybeAction;
        errors.push(...actionErrors);

        if (action?.properties.disabled?.effectiveValue) {
            disabledActions.push(action);
        } else if (action) {
            enabledActions.push(action);
        }
    }

    return {
        errors,
        result: { enabled: enabledActions, disabled: disabledActions },
    };
}

function parseAction(
    mapRange: Range,
    { getString, getBoolean, getMap, getEnumValue }: ValidatedMapItems,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedAction> {
    const errors: YamlParsingError[] = [];

    const maybeType = getEnumValue<ActionType>(ActionProperty.Type);
    const maybePhase = getEnumValue<ActionPhase>(ActionProperty.Phase);

    const maybeDescriptionWithKeyRange = getString(ActionProperty.Description);
    const maybeDisabledWithKeyRange = getBoolean(ActionProperty.Disabled);
    // The default value for 'disabled' is false, when not defined.
    const disabledEffectiveValue =
        maybeDisabledWithKeyRange !== undefined
            ? maybeDisabledWithKeyRange.value
            : false;

    const selector = parseIfPresent(
        getMap(ActionProperty.Selector),
        (selectorMap) => parseSelector(selectorMap, commonArgs),
        errors,
    );
    const variable = parseIfPresent(
        getMap(ActionProperty.Variable),
        (variableMap) => parseVariable(variableMap, commonArgs),
        errors,
    );

    return {
        errors,
        result: {
            valueRange: mapRange,
            properties: {
                phase: maybePhase,
                type: maybeType,
                description: stripKeyFromResult(maybeDescriptionWithKeyRange),
                disabled: {
                    effectiveValue: disabledEffectiveValue,
                    field: stripKeyFromResult(maybeDisabledWithKeyRange),
                },
                selector,
                variable,
            },
        },
    };
}

function parseSelector(
    { keyRange, value: selectorMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    ParsedYamlMapWithKeyAndValueRange<{
        expression?: WithKeyAndValueRange<string>;
        method?: WithKeyAndValueRange<ActionSelectorMethod>;
    }>
> {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = Object.values(ActionSelectorProperty);

    const { getString, getEnumValue } = getValidatedMapItems(
        selectorMap,
        {
            scalars: {
                stringValues: expectedStringScalars,
                enumValues: {
                    [ActionSelectorProperty.Method]:
                        Object.values(ActionSelectorMethod),
                },
            },
            // All properties are mandatory.
            mandatoryKeys: expectedStringScalars,
        },
        commonArgs,
        errors,
    );

    const maybeExpressionWithKeyRange = getString(
        ActionSelectorProperty.Expression,
    );
    const maybeTypedMethod = getEnumValue<ActionSelectorMethod>(
        ActionSelectorProperty.Method,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(selectorMap, commonArgs),
            properties: {
                expression: stripKeyFromResult(maybeExpressionWithKeyRange),
                method: maybeTypedMethod,
            },
        },
    };
}
function parseVariable(
    { keyRange, value: variableMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    ParsedYamlMapWithKeyAndValueRange<{
        name?: WithKeyAndValueRange<string>;
        scope?: WithKeyAndValueRange<ActionVariableScope>;
    }>
> {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = Object.values(ActionVariableProperty);

    const { getString, getEnumValue } = getValidatedMapItems(
        variableMap,
        {
            scalars: {
                stringValues: expectedStringScalars,
                enumValues: {
                    [ActionVariableProperty.Scope]:
                        Object.values(ActionVariableScope),
                },
            },
            // All properties are mandatory.
            mandatoryKeys: expectedStringScalars,
        },
        commonArgs,
        errors,
    );

    const maybeNameWithKeyRange = getString(ActionVariableProperty.Name);
    const maybeTypedScope = getEnumValue<ActionVariableScope>(
        ActionVariableProperty.Scope,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(variableMap, commonArgs),
            properties: {
                name: stripKeyFromResult(maybeNameWithKeyRange),
                scope: maybeTypedScope,
            },
        },
    };
}
