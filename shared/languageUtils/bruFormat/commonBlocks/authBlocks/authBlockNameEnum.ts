import { RequestFileBlockName } from "../../../..";

export enum AuthBlockName {
    BasicAuth = RequestFileBlockName.BasicAuth,
    BearerAuth = RequestFileBlockName.BearerAuth,
    ApiKeyAuth = RequestFileBlockName.ApiKeyAuth,
    AwsSigV4Auth = RequestFileBlockName.AwsSigV4Auth,
    DigestAuth = RequestFileBlockName.DigestAuth,
    NtlmAuth = RequestFileBlockName.NtlmAuth,
    OAuth2Auth = RequestFileBlockName.OAuth2Auth,
    OAuth1Auth = RequestFileBlockName.OAuth1Auth,
    WsseAuth = RequestFileBlockName.WsseAuth,
    AkamaiEdgeGridAuth = RequestFileBlockName.AkamaiEdgeGridAuth,
}
