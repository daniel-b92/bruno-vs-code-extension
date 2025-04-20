import { AuthBlockName } from "../definitions/authBlockNameEnum";
import {
    ApiKeyAuthBlockKey,
    AwsV4AuthBlockKey,
    BasicAuthBlockKey,
    BearerAuthBlockKey,
    DigestAuthBlockKey,
    NtlmAuthBlockKey,
    OAuth2ViaAuthorizationCodeBlockKey,
    OAuth2ViaClientCredentialsBlockKey,
    OAuth2ViaPasswordBlockKey,
    WsseAuthBlockKey,
} from "../definitions/authBlocksKeyEnums";

export function getMandatoryKeysForAuthBlock(
    authBlockName: AuthBlockName
): string[] | undefined {
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
    } else if (authBlockName == AuthBlockName.OAuth2Auth) {
        // ToDo: Get mandatory keys depending on grant type
        return Object.values(OAuth2ViaAuthorizationCodeBlockKey).filter(
            (val) =>
                (
                    Object.values(
                        OAuth2ViaClientCredentialsBlockKey
                    ) as string[]
                ).includes(val) &&
                (Object.values(OAuth2ViaPasswordBlockKey) as string[]).includes(
                    val
                )
        );
    } else if (authBlockName == AuthBlockName.WsseAuth) {
        return Object.values(WsseAuthBlockKey);
    } else if (authBlockName == AuthBlockName.ApiKeyAuth) {
        return Object.values(ApiKeyAuthBlockKey);
    }
}
