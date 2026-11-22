import { describe, expect, it } from "@jest/globals";
import { OAuth2Flow } from "./authConstants";
import {
    getIgnoredKeysForOAuth2Flow,
    getKeysForOAuth2Flow,
} from "./oAuth2FlowKeys";

describe("getKeysForOAuth2Flow", () => {
    it.each(Object.values(OAuth2Flow))(
        "returns keys for the flow '%s'",
        (flow) => {
            expect(getKeysForOAuth2Flow(flow).length).toBeGreaterThan(0);
        },
    );

    it("returns the keys in the order of Bruno's UI", () => {
        const keysByFlow = Object.fromEntries(
            Object.values(OAuth2Flow).map((flow) => [
                flow,
                getKeysForOAuth2Flow(flow).map(({ key, childKeys }) =>
                    childKeys ? `${key}(${childKeys.join(",")})` : key,
                ),
            ]),
        );

        expect(keysByFlow).toEqual({
            authorization_code: [
                "authorizationUrl",
                "accessTokenUrl",
                "callbackUrl",
                "credentials(clientId,clientSecret)",
                "scope",
                "state",
            ],
            client_credentials: [
                "accessTokenUrl",
                "credentials(clientId,clientSecret)",
                "scope",
            ],
            implicit: [
                "authorizationUrl",
                "callbackUrl",
                "credentials(clientId)",
                "scope",
                "state",
            ],
            resource_owner_password_credentials: [
                "accessTokenUrl",
                "resourceOwner(username,password)",
                "credentials(clientId,clientSecret)",
                "scope",
            ],
        });
    });
});

describe("getIgnoredKeysForOAuth2Flow", () => {
    it("returns the keys that Bruno ignores for each flow", () => {
        const keysByFlow = Object.fromEntries(
            Object.values(OAuth2Flow).map((flow) => [
                flow,
                getIgnoredKeysForOAuth2Flow(flow).map(({ key, childKey }) =>
                    childKey ? `${key}.${childKey}` : key,
                ),
            ]),
        );

        expect(keysByFlow).toEqual({
            authorization_code: ["resourceOwner"],
            client_credentials: [
                "authorizationUrl",
                "callbackUrl",
                "state",
                "pkce",
                "additionalParameters.authorizationRequest",
                "resourceOwner",
            ],
            resource_owner_password_credentials: [
                "authorizationUrl",
                "callbackUrl",
                "state",
                "pkce",
                "additionalParameters.authorizationRequest",
            ],
            implicit: [
                "accessTokenUrl",
                "refreshTokenUrl",
                "credentials.clientSecret",
                "credentials.placement",
                "resourceOwner",
                "pkce",
                "additionalParameters.accessTokenRequest",
                "additionalParameters.refreshTokenRequest",
            ],
        });
    });

    it.each(Object.values(OAuth2Flow))(
        "does not report keys that are used for the flow '%s'",
        (flow) => {
            const usedKeys = getKeysForOAuth2Flow(flow).flatMap(
                ({ key, childKeys }) => [
                    key,
                    ...(childKeys ?? []).map((child) => `${key}.${child}`),
                ],
            );

            getIgnoredKeysForOAuth2Flow(flow).forEach(({ key, childKey }) =>
                expect(usedKeys).not.toContain(
                    childKey ? `${key}.${childKey}` : key,
                ),
            );
        },
    );
});
