import { RequestFileBlockName } from "../../../requestFiles/requestFileBlockNameEnum";

export const Oauth2AdditionalParamsBlockNames = {
    OAuth2AdditionalParams_AccessTokenReq_Body:
        RequestFileBlockName.OAuth2AdditionalParams_AccessTokenReq_Body,
    OAuth2AdditionalParams_AccessTokenReq_Headers:
        RequestFileBlockName.OAuth2AdditionalParams_AccessTokenReq_Headers,
    OAuth2AdditionalParams_AccessTokenReq_QueryParams:
        RequestFileBlockName.OAuth2AdditionalParams_AccessTokenReq_QueryParams,
    OAuth2AdditionalParams_AuthReq_Headers:
        RequestFileBlockName.OAuth2AdditionalParams_AuthReq_Headers,
    OAuth2AdditionalParams_AuthReq_QueryParams:
        RequestFileBlockName.OAuth2AdditionalParams_AuthReq_QueryParams,
    OAuth2AdditionalParams_RefreshTokenReq_Body:
        RequestFileBlockName.OAuth2AdditionalParams_RefreshTokenReq_Body,
    OAuth2AdditionalParams_RefreshTokenReq_Headers:
        RequestFileBlockName.OAuth2AdditionalParams_RefreshTokenReq_Headers,
    OAuth2AdditionalParams_RefreshTokenReq_QueryParams:
        RequestFileBlockName.OAuth2AdditionalParams_RefreshTokenReq_QueryParams,
} as const;
