import { describe, expect, it } from "@jest/globals";
import { OAuth2Flow } from "./authConstants";
import { getKeysForOAuth2Flow } from "./oAuth2FlowKeys";

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
