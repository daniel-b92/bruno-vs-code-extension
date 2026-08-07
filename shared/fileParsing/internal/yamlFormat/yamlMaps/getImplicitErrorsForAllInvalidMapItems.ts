import { Range } from "../../../..";
import { CommonParsingArgs } from "../interfaces";
import { getErrorForValueWithUnexpectedType } from "../parsingErrors/getErrorForValueWithUnexpectedType";

export function getImplicitErrorsForAllInvalidMapItems(
    items: {
        invalidScalars: { key: string; valueRange: Range }[];
        invalidSequences: { key: string; valueRange: Range }[];
    },
    commonArgs: CommonParsingArgs,
) {
    const { invalidScalars, invalidSequences } = items;
    return invalidScalars
        .map(({ key, valueRange }) =>
            getErrorForValueWithUnexpectedType({
                ...commonArgs,
                key,
                valueRange,
                expectedType: "Scalar",
            }),
        )
        .concat(
            invalidSequences.map(({ key, valueRange }) =>
                getErrorForValueWithUnexpectedType({
                    ...commonArgs,
                    key,
                    valueRange,
                    expectedType: "Sequence",
                }),
            ),
        );
}
