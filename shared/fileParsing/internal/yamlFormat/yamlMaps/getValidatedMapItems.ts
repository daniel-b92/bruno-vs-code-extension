import { YAMLMap, YAMLSeq } from "yaml";
import { YamlMapMissingPropertyInfo, YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    ParsedMapItems,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { ExpectedKeys, getMapItems } from "./getMapItems";

export interface ValidatedMapItems {
    items: ParsedMapItems;
    missingProperties: YamlMapMissingPropertyInfo[];
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
}

/**
 * Wraps {@link getMapItems} and additionally handles the validation that is common to all Yaml maps:
 * - Adds an error for every unknown key.
 * - Adds an error for every missing mandatory key.
 * - Derives the info about missing properties from the expected keys.
 *
 * All errors are appended to `collectedErrors`.
 *
 * Additionally, the result provides lookup functions for the valid items of a specific key.
 * They return `undefined`, if the key is missing or if its value does not have the expected type.
 *
 * @param mandatoryKeys Keys that have to be defined. All other expected keys are optional.
 * @param additionalAllowedKeys Keys that are valid, but get handled by the caller (e.g. because they need special parsing).
 * No errors are added for these keys, even though they are not part of the expected keys.
 * @param silentlyAllowedKeys Like `additionalAllowedKeys`, but the keys are not listed as allowed keys in error messages
 * (e.g. because they are reported by a dedicated check).
 */
export function getValidatedMapItems(
    map: YAMLMap,
    expectedKeys: ExpectedKeys & {
        mandatoryKeys?: string[];
        additionalAllowedKeys?: string[];
        silentlyAllowedKeys?: string[];
    },
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ValidatedMapItems {
    const {
        mandatoryKeys = [],
        additionalAllowedKeys = [],
        silentlyAllowedKeys = [],
        ...keysForParsing
    } = expectedKeys;
    const { items, errors } = getMapItems(map, keysForParsing, commonArgs);
    const { unknownKeys, missingKeys } = items;

    const allowedKeys = [
        ...new Set([
            ...Object.values(keysForParsing.scalars ?? {}).flatMap(
                (keys) => keys ?? [],
            ),
            ...(keysForParsing.mapValues ?? []),
            ...(keysForParsing.sequenceValues ?? []),
            ...additionalAllowedKeys,
        ]),
    ];
    // Keys that can only have a scalar value (and not also a map or sequence).
    const nonScalarKeys = [
        ...(keysForParsing.mapValues ?? []),
        ...(keysForParsing.sequenceValues ?? []),
    ];

    collectedErrors.push(
        ...errors,
        ...unknownKeys
            .filter(
                ({ key }) =>
                    !additionalAllowedKeys.includes(key) &&
                    !silentlyAllowedKeys.includes(key),
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
        missingProperties: missingKeys.map((key) => ({
            key,
            alwaysHasScalarValue: !nonScalarKeys.includes(key),
            isMandatory: mandatoryKeys.includes(key),
        })),
    };
}

function findByKey<T extends { key: string }>(items: T[], key: string) {
    return items.find((item) => item.key == key);
}
