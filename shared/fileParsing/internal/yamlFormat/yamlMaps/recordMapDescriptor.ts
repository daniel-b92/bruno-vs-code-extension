import { YamlExpectedKeyInfo, YamlValueKind } from "../../../..";
import { CommonParsingArgs, ParsedMapItems } from "../interfaces";
import { ExpectedKeys } from "./getMapItems";

export interface AdditionalAllowedKey {
    key: string;
    valueKinds: YamlValueKind[];
}

/**
 * Appends a descriptor for a validated map to the sink of the common parsing args (if there is one).
 * Does nothing, if no descriptors are collected.
 *
 * @param additionalKeys Keys that are expected as well, but are not part of the `expectedKeys` (because the caller handles them).
 */
export function recordMapDescriptor({
    items: { definedKeys },
    expectedKeys: { scalars, mapValues, sequenceValues },
    mandatoryKeys = [],
    additionalKeys = [],
    commonArgs: { mapDescriptors },
}: {
    items: Pick<ParsedMapItems, "definedKeys">;
    expectedKeys: ExpectedKeys;
    mandatoryKeys?: string[];
    additionalKeys?: AdditionalAllowedKey[];
    commonArgs: CommonParsingArgs;
}) {
    if (!mapDescriptors) {
        return;
    }

    const kindsByKey = new Map<string, YamlValueKind[]>();
    const addKind = (key: string, kind: YamlValueKind) => {
        const kinds = kindsByKey.get(key) ?? [];
        if (!kinds.includes(kind)) {
            kinds.push(kind);
        }
        kindsByKey.set(key, kinds);
    };
    const enumValues = scalars?.enumValues ?? {};

    for (const key of scalars?.stringValues ?? []) {
        addKind(key, "string");
    }
    for (const key of Object.keys(enumValues)) {
        addKind(key, "string");
    }
    for (const key of scalars?.booleanValues ?? []) {
        addKind(key, "boolean");
    }
    for (const key of scalars?.numericValues ?? []) {
        addKind(key, "number");
    }
    for (const key of mapValues ?? []) {
        addKind(key, "map");
    }
    for (const key of sequenceValues ?? []) {
        addKind(key, "sequence");
    }
    for (const { key, valueKinds } of additionalKeys) {
        valueKinds.forEach((kind) => addKind(key, kind));
    }

    const expectedKeyInfos: YamlExpectedKeyInfo[] = [...kindsByKey].map(
        ([key, valueKinds]) => ({
            key,
            valueKinds,
            isMandatory: mandatoryKeys.includes(key),
            ...(key in enumValues ? { allowedValues: enumValues[key] } : {}),
        }),
    );

    mapDescriptors.push({
        definedKeys: definedKeys.map(({ key, keyRange, valueRange }) => ({
            key,
            keyRange,
            valueRange,
        })),
        expectedKeys: expectedKeyInfos,
    });
}
