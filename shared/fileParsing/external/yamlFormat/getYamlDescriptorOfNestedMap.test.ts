import { describe, expect, it } from "@jest/globals";
import { BrunoFileType } from "../../..";
import { getDescriptorsForText } from "./getDescriptorsForText";
import { getYamlDescriptorOfNestedMap } from "./getYamlDescriptorOfNestedMap";

describe("getYamlDescriptorOfNestedMap", () => {
    it("returns the descriptor of the map that is the value of the given key", () => {
        const { descriptors, authMap } = getDescriptors(
            "    credentials:\n      clientId: a\n      clientSecret: b\n    scope: x\n",
        );

        const nested = getYamlDescriptorOfNestedMap(
            descriptors,
            authMap.definedKeys.find(({ key }) => key == "credentials")!,
        );

        expect(nested?.definedKeys.map(({ key }) => key)).toEqual([
            "clientId",
            "clientSecret",
        ]);
    });

    it("distinguishes between several nested maps", () => {
        const { descriptors, authMap } = getDescriptors(
            "    resourceOwner:\n      username: u\n    credentials:\n      clientId: a\n",
        );

        const nested = getYamlDescriptorOfNestedMap(
            descriptors,
            authMap.definedKeys.find(({ key }) => key == "credentials")!,
        );

        expect(nested?.definedKeys.map(({ key }) => key)).toEqual(["clientId"]);
    });

    it("returns undefined for a key without a map value", () => {
        const { descriptors, authMap } = getDescriptors(
            "    credentials:\n    scope: x\n",
        );

        expect(
            getYamlDescriptorOfNestedMap(
                descriptors,
                authMap.definedKeys.find(({ key }) => key == "credentials")!,
            ),
        ).toBeUndefined();
    });

    it("returns undefined if the key has no value range", () => {
        expect(getYamlDescriptorOfNestedMap([], {})).toBeUndefined();
    });
});

function getDescriptors(authContent: string) {
    const descriptors = getDescriptorsForText(
        `http:\n  method: GET\n  auth:\n    type: oauth2\n    flow: client_credentials\n${authContent}`,
        BrunoFileType.RequestFile,
    );
    const authMap = descriptors.find(({ definedKeys }) =>
        definedKeys.some(({ key }) => key == "flow"),
    )!;

    return { descriptors, authMap };
}
