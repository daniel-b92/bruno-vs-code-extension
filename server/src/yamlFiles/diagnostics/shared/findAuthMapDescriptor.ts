import { ParsedAuth, YamlMapDescriptor } from "@global_shared";

/**
 * Finds the descriptor of the map of an auth with properties.
 * The auth map is the one that defines the `type` key at the position of the parsed type.
 */
export function findAuthMapDescriptor(
    properties: Extract<
        ParsedAuth["value"],
        { properties: unknown }
    >["properties"],
    mapDescriptors: YamlMapDescriptor[],
): YamlMapDescriptor | undefined {
    return mapDescriptors.find(({ definedKeys }) =>
        definedKeys.some(
            ({ key, keyRange }) =>
                key == "type" && keyRange.equals(properties.type.keyRange),
        ),
    );
}
