import { AuthBlockName } from "../../../languageUtils/authBlocks/authBlockNameEnum";
import {
    ApiKeyAuthBlockKey,
    AwsV4AuthBlockKey,
    BasicAuthBlockKey,
    BearerAuthBlockKey,
    DigestAuthBlockKey,
    NtlmAuthBlockKey,
    WsseAuthBlockKey,
} from "../../../languageUtils/authBlocks/authBlocksKeyEnums";

export function getMandatoryKeysForNonOAuth2Block(
    authBlockName:
        | AuthBlockName.BasicAuth
        | AuthBlockName.BearerAuth
        | AuthBlockName.DigestAuth
        | AuthBlockName.ApiKeyAuth
        | AuthBlockName.AwsSigV4Auth
        | AuthBlockName.NtlmAuth
        | AuthBlockName.WsseAuth
): string[] {
    if (authBlockName == AuthBlockName.BasicAuth) {
        return Object.values(BasicAuthBlockKey);
    } else if (authBlockName == AuthBlockName.BearerAuth) {
        return Object.values(BearerAuthBlockKey);
    } else if (authBlockName == AuthBlockName.DigestAuth) {
        return Object.values(DigestAuthBlockKey);
    } else if (authBlockName == AuthBlockName.AwsSigV4Auth) {
        return Object.values(AwsV4AuthBlockKey);
    } else if (authBlockName == AuthBlockName.NtlmAuth) {
        return Object.values(NtlmAuthBlockKey);
    } else if (authBlockName == AuthBlockName.WsseAuth) {
        return Object.values(WsseAuthBlockKey);
    } else {
        return Object.values(ApiKeyAuthBlockKey);
    }
}
