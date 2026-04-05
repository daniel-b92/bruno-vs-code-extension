import {
    MethodBlockKey,
    MethodBlockBody,
    MethodBlockAuth,
    Block,
    getMandatoryKeysForMethodBlock,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";
import { getKeyRangeContainingPosition } from "../generic/getKeyRangeContainingPosition";
import { getKeysUsedInOtherLines } from "../generic/getKeysUsedInOtherLines";
import { getTextEditForKeyCompletion } from "../generic/getTextEditForKeyCompletion";

export function getMethodBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    const keyRangeContainingPosition = getKeyRangeContainingPosition(
        request,
        block,
    );

    if (keyRangeContainingPosition != undefined) {
        const usedKeysInOtherLines = getKeysUsedInOtherLines(request, block);
        return getMandatoryKeysForMethodBlock(block.name)
            .filter((mandatory) => !usedKeysInOtherLines.includes(mandatory))
            .map((key) => ({
                label: key,
                textEdit: getTextEditForKeyCompletion(
                    keyRangeContainingPosition,
                    key,
                ),
            }));
    }

    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Body,
                ),
                choices: Object.values(MethodBlockBody),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Auth,
                ),
                choices: Object.values(MethodBlockAuth),
            },
        ],
        request,
    );
}
