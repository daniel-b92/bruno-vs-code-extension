import { describe, it, expect } from "@jest/globals";
import { getParamsFromUrl } from "./getParamsFromUrl";

describe("getParamsFromUrl", () => {
    it("returns query and path params as they are written in the URL", () => {
        expect(
            getParamsFromUrl("{{host}}/users/:id/:section?a=1&flag&b={{x}}"),
        ).toEqual({
            query: [
                { name: "a", value: "1" },
                { name: "flag", value: "" },
                { name: "b", value: "{{x}}" },
            ],
            path: [
                { name: "id", value: "" },
                { name: "section", value: "" },
            ],
        });
    });

    it("returns repeated path params only once", () => {
        expect(getParamsFromUrl("{{host}}/:id/children/:id").path).toEqual([
            { name: "id", value: "" },
        ]);
    });

    it("returns no params for a URL without any", () => {
        expect(getParamsFromUrl("https://example.com/users")).toEqual({
            query: [],
            path: [],
        });
    });
});
