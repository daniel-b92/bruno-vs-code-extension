import { YamlParsingError } from "../../../..";
import { MaybeResultWithErrors } from "../interfaces";

/**
 * Parses the given item, if it is defined, and appends the resulting errors to `collectedErrors`.
 * @returns The parsed result or `undefined`, if the item is not defined or could not be parsed.
 */
export function parseIfPresent<TItem, TResult>(
    item: TItem | undefined,
    parse: (item: TItem) => MaybeResultWithErrors<TResult>,
    collectedErrors: YamlParsingError[],
): TResult | undefined {
    if (item === undefined) {
        return undefined;
    }

    const { result, errors } = parse(item);
    collectedErrors.push(...errors);

    return result;
}
