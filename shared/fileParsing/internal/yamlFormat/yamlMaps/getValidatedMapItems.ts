import { YAMLMap, YAMLSeq } from "yaml";
import { WithKeyAndValueRange, YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    ParsedMapItems,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { getErrorForInvalidEnumValue } from "../parsingErrors/getErrorForInvalidEnumValue";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { ExpectedKeys, getMapItems, getStringKeys } from "./getMapItems";
import {
    AdditionalAllowedKey,
    recordMapDescriptor,
} from "./recordMapDescriptor";

export interface ValidatedMapItems {
    items: ParsedMapItems;
    getString: (
        key: string,
    ) => WithKeyKeyRangeAndValueRange<string> | undefined;
    getBoolean: (
        key: string,
    ) => WithKeyKeyRangeAndValueRange<boolean> | undefined;
    getNumber: (
        key: string,
    ) => WithKeyKeyRangeAndValueRange<number> | undefined;
    getMap: (key: string) => WithKeyAndKeyRange<YAMLMap> | undefined;
    getSequence: (key: string) => WithKeyAndKeyRange<YAMLSeq> | undefined;
    /**
     * Returns the string value for a key that has been passed as an enum key.
     * Returns `undefined`, if the key is missing or if the value is not one of the allowed values.
     * The error for an invalid value has already been added when validating the map.
     */
    getEnumValue: <T extends string>(
        key: string,
    ) => WithKeyAndValueRange<T> | undefined;
}

/**
 * Wraps {@link getMapItems} and additionally handles the validation that is common to all Yaml maps:
 * - Adds an error for every unknown key.
 * - Adds an error for every missing mandatory key.
 * - Adds an error for every enum key with a value that is not one of the allowed values.
 * - Records a descriptor of the map, if the common args have a sink for them.
 *
 * All errors are appended to `collectedErrors`.
 *
 * Additionally, the result provides lookup functions for the valid items of a specific key.
 * They return `undefined`, if the key is missing or if its value does not have the expected type.
 *
 * @param mandatoryKeys Keys that have to be defined. All other expected keys are optional.
 * @param additionalAllowedKeys Keys that are valid, but get handled by the caller (e.g. because they need special parsing).
 * No errors are added for these keys, even though they are not part of the expected keys.
 * They are listed as expected keys in the descriptor with the given value kinds.
 * @param silentlyAllowedKeys Like `additionalAllowedKeys`, but the keys are not listed as allowed keys in error messages
 * (e.g. because they are reported by a dedicated check).
 * @param hiddenEnumValues Values for enum keys that are valid as well, but are not listed as allowed values in the descriptor
 * (e.g. because they are reported by a dedicated check). A key that only has hidden values is not listed with a string value in the descriptor.
 */
export function getValidatedMapItems(
    map: YAMLMap,
    expectedKeys: ExpectedKeys & {
        mandatoryKeys?: string[];
        additionalAllowedKeys?: AdditionalAllowedKey[];
        silentlyAllowedKeys?: string[];
        hiddenEnumValues?: Record<string, readonly string[]>;
    },
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ValidatedMapItems {
    const {
        mandatoryKeys = [],
        additionalAllowedKeys = [],
        silentlyAllowedKeys = [],
        hiddenEnumValues = {},
        ...keysForDescriptor
    } = expectedKeys;
    const keysForParsing = addHiddenEnumValues(
        keysForDescriptor,
        hiddenEnumValues,
    );
    const { items, errors } = getMapItems(map, keysForParsing, commonArgs);
    const { unknownKeys, missingKeys } = items;

    const allowedKeys = [
        ...new Set([
            ...(keysForParsing.scalars?.booleanValues ?? []),
            ...(keysForParsing.scalars?.numericValues ?? []),
            ...getStringKeys(keysForParsing),
            ...(keysForParsing.mapValues ?? []),
            ...(keysForParsing.sequenceValues ?? []),
            ...additionalAllowedKeys.map(({ key }) => key),
        ]),
    ];

    recordMapDescriptor({
        items,
        expectedKeys: keysForDescriptor,
        mandatoryKeys,
        additionalKeys: additionalAllowedKeys,
        commonArgs,
    });

    const enumValues = keysForParsing.scalars?.enumValues ?? {};
    const validEnumFields = Object.entries(enumValues).flatMap(
        ([key, allowedValues]) => {
            const field = findByKey(items.validScalars.withStringValue, key);
            if (!field) {
                return [];
            }
            if (!allowedValues.includes(field.value)) {
                collectedErrors.push(
                    getErrorForInvalidEnumValue(field, allowedValues),
                );
                return [];
            }
            return [field];
        },
    );

    collectedErrors.push(
        ...errors,
        ...unknownKeys
            .filter(
                ({ key }) =>
                    !additionalAllowedKeys.some(
                        ({ key: allowedKey }) => allowedKey == key,
                    ) && !silentlyAllowedKeys.includes(key),
            )
            .map(({ key: unknownKey, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey,
                    keyRange,
                    allowedKeys,
                }),
            ),
        ...missingKeys
            .filter((key) => mandatoryKeys.includes(key))
            .map((missingKey) =>
                getErrorForMissingKeyInMap({ ...commonArgs, missingKey, map }),
            ),
    );

    return {
        items,
        getString: (key) => findByKey(items.validScalars.withStringValue, key),
        getBoolean: (key) =>
            findByKey(items.validScalars.withBooleanValue, key),
        getNumber: (key) => findByKey(items.validScalars.withNumericValue, key),
        getMap: (key) => findByKey(items.validMaps, key),
        getSequence: (key) => findByKey(items.validSequences, key),
        getEnumValue: <T extends string>(key: string) =>
            stripKeyFromResult(findByKey(validEnumFields, key)) as
                WithKeyAndValueRange<T> | undefined,
    };
}

function addHiddenEnumValues(
    expectedKeys: ExpectedKeys,
    hiddenEnumValues: Record<string, readonly string[]>,
): ExpectedKeys {
    const enumValues = { ...expectedKeys.scalars?.enumValues };
    for (const [key, values] of Object.entries(hiddenEnumValues)) {
        enumValues[key] = [...(enumValues[key] ?? []), ...values];
    }

    return {
        ...expectedKeys,
        scalars: { ...expectedKeys.scalars, enumValues },
    };
}

function findByKey<T extends { key: string }>(items: T[], key: string) {
    return items.find((item) => item.key == key);
}
