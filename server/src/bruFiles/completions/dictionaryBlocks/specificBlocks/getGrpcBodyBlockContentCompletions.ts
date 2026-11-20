import { Block, GrpcBodyBlockKey } from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";

export function getGrpcBodyBlockContentCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    return getCompletionsForKeys(request, block, {
        mandatory: Object.values(GrpcBodyBlockKey),
    });
}
