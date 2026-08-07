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

    return [
        { fields: invalidScalars, type: "Scalar" as const },
        { fields: invalidSequences, type: "Sequence" as const },
    ].flatMap(({ fields, type }) =>
        fields.map(({ key, valueRange }) =>
            getErrorForValueWithUnexpectedType({
                ...commonArgs,
                key,
                valueRange,
                expectedType: type,
            }),
        ),
    );
}
