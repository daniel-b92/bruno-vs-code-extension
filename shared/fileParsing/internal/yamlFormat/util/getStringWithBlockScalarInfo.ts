import { isScalar, Scalar, YAMLMap } from "yaml";
import {
    ParsedStringScalarWithStyle,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { stripKeyFromResult } from "./stripKeyFromResult";

/**
 * Extends the given parsed string value with information about the scalar style that is used for the key in the map.
 */
export function getStringWithBlockScalarInfo(
    map: YAMLMap,
    key: string,
    rawString: WithKeyKeyRangeAndValueRange<string> | undefined,
): ParsedStringScalarWithStyle | undefined {
    return (
        rawString && {
            ...stripKeyFromResult(rawString),
            isLiteralBlockScalar: isLiteralBlockScalar(map.get(key, true)),
        }
    );
}

function isLiteralBlockScalar(node: unknown) {
    return isScalar(node) && node.type == Scalar.BLOCK_LITERAL;
}
