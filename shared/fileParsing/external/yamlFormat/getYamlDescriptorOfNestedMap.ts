import { Range, YamlMapDescriptor } from "../../..";

/**
 * Finds the descriptor of the map that is the value of the given key.
 * The descriptors of a document don't carry a path, so the map is identified by its keys lying within the value of its parent key.
 * Only works for maps without nested maps of their own, since the match would not be unique otherwise.
 *
 * @returns `undefined`, if the map is not defined or has no keys.
 */
export function getYamlDescriptorOfNestedMap(
    descriptors: YamlMapDescriptor[],
    parentKey: { valueRange?: Range },
): YamlMapDescriptor | undefined {
    const { valueRange } = parentKey;

    return valueRange
        ? descriptors.find(
              ({ definedKeys }) =>
                  definedKeys.length > 0 &&
                  definedKeys.every(
                      ({ keyRange }) =>
                          valueRange.contains(keyRange.start) &&
                          valueRange.contains(keyRange.end),
                  ),
          )
        : undefined;
}
