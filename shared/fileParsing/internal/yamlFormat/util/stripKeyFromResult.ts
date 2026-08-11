import { WithKeyKeyRangeAndValueRange } from "../interfaces";

export function stripKeyFromResult<T>(result: WithKeyKeyRangeAndValueRange<T>) {
    const { key, ...rest } = result;
    return rest;
}
