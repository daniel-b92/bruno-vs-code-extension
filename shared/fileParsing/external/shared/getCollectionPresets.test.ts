import { describe, it, expect } from "@jest/globals";
import { CollectionFormat, RequestType } from "../../..";
import { getCollectionPresetsFromFileContent } from "./getCollectionPresets";

describe("getCollectionPresetsFromFileContent", () => {
    it("reads the presets from a bruno.json", () => {
        expect(
            getCollectionPresetsFromFileContent(
                CollectionFormat.Bru,
                JSON.stringify({
                    presets: { requestType: "ws", requestUrl: "ws://host" },
                }),
            ),
        ).toEqual({ requestType: RequestType.Ws, requestUrl: "ws://host" });
    });

    it("ignores unknown request types in a bruno.json", () => {
        expect(
            getCollectionPresetsFromFileContent(
                CollectionFormat.Bru,
                JSON.stringify({
                    presets: { requestType: "soap", requestUrl: "http://a" },
                }),
            ),
        ).toEqual({ requestType: undefined, requestUrl: "http://a" });
    });

    it("returns no values for a bruno.json without presets or with invalid JSON", () => {
        expect(
            getCollectionPresetsFromFileContent(CollectionFormat.Bru, "{}"),
        ).toEqual({ requestType: undefined, requestUrl: undefined });
        expect(
            getCollectionPresetsFromFileContent(CollectionFormat.Bru, "{"),
        ).toEqual({ requestType: undefined, requestUrl: undefined });
    });

    it("reads the presets from a yaml collection root file", () => {
        expect(
            getCollectionPresetsFromFileContent(
                CollectionFormat.Yaml,
                [
                    "extensions:",
                    "  bruno:",
                    "    presets:",
                    "      request:",
                    "        type: ws",
                    "        url: ws://host",
                    "",
                ].join("\n"),
            ),
        ).toEqual({ requestType: RequestType.Ws, requestUrl: "ws://host" });
    });

    it("returns no values for a yaml collection root file without presets", () => {
        expect(
            getCollectionPresetsFromFileContent(
                CollectionFormat.Yaml,
                "opencollection: 1.0.0\n",
            ),
        ).toEqual({ requestType: undefined, requestUrl: undefined });
    });
});
