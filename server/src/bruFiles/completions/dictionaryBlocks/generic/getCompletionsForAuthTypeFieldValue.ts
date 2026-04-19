import {
    AuthBlockName,
    AuthBlockNamesExcludingOAuth2,
    Block,
    getAuthTypesForNoDefinedAuthBlock,
    getExpectedAuthBlockForType,
    getMandatoryKeysForNonOAuth2Block,
    isAuthBlock,
    LineBreakType,
    MethodBlockAuthValues,
    OAuth2AuthBlocksCommonKeys,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getTextEditForInsertingBlock } from "../../../shared/getTextEditForInsertingBlock";
import { getTextEditForRemovingBlock } from "../../../shared/getTextEditForRemovingBlock";
import { getTextEditForDictionaryBlockSimpleValue } from "./getTextEditForDictionaryBlockSimpleValue";

export function getCompletionsForAuthTypeFieldValue(
    { documentHelper, position: { line } }: LanguageFeatureBaseRequest,
    allBlocks: Block[],
    blockContainingPosition: Block,
    content: { currentLineContent: string; lineBreak: LineBreakType },
) {
    const { currentLineContent, lineBreak } = content;
    const existingAuthBlocks = allBlocks.filter(({ name }) =>
        isAuthBlock(name),
    );
    const authTypesWithoutAnAuthBlock = getAuthTypesForNoDefinedAuthBlock();

    if (existingAuthBlocks.length <= 1) {
        return Object.values(MethodBlockAuthValues)
            .map((authType) => {
                const label = authType;
                const textEdit = getTextEditForDictionaryBlockSimpleValue(
                    line,
                    currentLineContent,
                    authType,
                );

                if (
                    authTypesWithoutAnAuthBlock.includes(authType) &&
                    existingAuthBlocks.length > 0
                ) {
                    return {
                        label,
                        textEdit,
                        additionalTextEdits: [
                            getTextEditForRemovingBlock(
                                documentHelper,
                                existingAuthBlocks[0],
                            ),
                        ].filter((val) => val != undefined),
                    };
                }

                if (
                    !authTypesWithoutAnAuthBlock.includes(authType) &&
                    existingAuthBlocks.length == 0
                ) {
                    const newAuthBlockName =
                        getExpectedAuthBlockForType(authType);
                    const authBlockKeys =
                        newAuthBlockName == AuthBlockName.OAuth2Auth
                            ? Object.values(OAuth2AuthBlocksCommonKeys)
                            : getMandatoryKeysForNonOAuth2Block(
                                  newAuthBlockName as AuthBlockNamesExcludingOAuth2,
                              );

                    return {
                        label,
                        textEdit,
                        additionalTextEdits: [
                            getTextEditForInsertingBlock(
                                blockContainingPosition,
                                {
                                    blockName: newAuthBlockName,
                                    content: { keys: authBlockKeys },
                                    lineBreak,
                                },
                            ),
                        ].filter((val) => val != undefined),
                    };
                }

                return { label, textEdit };
            })
            .filter((val) => val != undefined);
    }
}
