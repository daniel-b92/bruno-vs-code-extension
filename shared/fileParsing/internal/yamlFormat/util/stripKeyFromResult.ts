import { WithKeyKeyRangeAndValueRange } from "../interfaces";

export function stripKeyFromResult<T>(
    result: WithKeyKeyRangeAndValueRange<T>,
): Omit<WithKeyKeyRangeAndValueRange<T>, "key">;
export function stripKeyFromResult<T>(
    result: WithKeyKeyRangeAndValueRange<T> | undefined,
): Omit<WithKeyKeyRangeAndValueRange<T>, "key"> | undefined;
export function stripKeyFromResult<T>(
    result: WithKeyKeyRangeAndValueRange<T> | undefined,
) {
    if (!result) {
        return undefined;
    }
    const { key, ...rest } = result;
    return rest;
}
