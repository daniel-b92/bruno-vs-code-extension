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
            isLiteralBlockScalar: hasScalarType(
                map.get(key, true),
                Scalar.BLOCK_LITERAL,
            ),
            isPlainScalar: hasScalarType(map.get(key, true), Scalar.PLAIN),
        }
    );
}

function hasScalarType(node: unknown, type: Scalar.Type) {
    return isScalar(node) && node.type == type;
}
