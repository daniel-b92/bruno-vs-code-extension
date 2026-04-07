import { AuthBlockName } from "./authBlockNameEnum";
import {
    ApiKeyAuthBlockKey,
    AwsV4AuthBlockKey,
    BasicAuthBlockKey,
    BearerAuthBlockKey,
    DigestAuthBlockKey,
    NtlmAuthBlockKey,
    WsseAuthBlockKey,
} from "./authBlocksKeyInterfaces";

export type AuthBlockNameeExcludingOAuth2 = Exclude<
    AuthBlockName,
    AuthBlockName.OAuth2Auth
>;

export function getMandatoryKeysForNonOAuth2Block(
    authBlockName: AuthBlockNameeExcludingOAuth2,
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
