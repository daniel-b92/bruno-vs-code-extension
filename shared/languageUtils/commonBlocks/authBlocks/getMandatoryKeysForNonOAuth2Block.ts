import { AuthBlockName } from "./authBlockNameEnum";
import {
    ApiKeyAuthBlockKeys,
    AwsV4AuthBlockKey,
    BasicAuthBlockKey,
    BearerAuthBlockKey,
    DigestAuthBlockKey,
    NtlmAuthBlockKey,
    WsseAuthBlockKeys,
} from "./authBlocksKeyInterfaces";

export type AuthBlockNamesExcludingOAuth2 = Exclude<
    AuthBlockName,
    AuthBlockName.OAuth2Auth
>;

export function getMandatoryKeysForNonOAuth2Block(
    authBlockName: AuthBlockNamesExcludingOAuth2,
): string[] {
    switch (authBlockName) {
        case AuthBlockName.BasicAuth:
            return Object.values(BasicAuthBlockKey);
        case AuthBlockName.BearerAuth:
            return Object.values(BearerAuthBlockKey);
        case AuthBlockName.DigestAuth:
            return Object.values(DigestAuthBlockKey);
        case AuthBlockName.AwsSigV4Auth:
            return Object.values(AwsV4AuthBlockKey);
        case AuthBlockName.NtlmAuth:
            return Object.values(NtlmAuthBlockKey);
        case AuthBlockName.WsseAuth:
            return Object.values(WsseAuthBlockKeys);
        case AuthBlockName.ApiKeyAuth:
            return Object.values(ApiKeyAuthBlockKeys);
    }
}
