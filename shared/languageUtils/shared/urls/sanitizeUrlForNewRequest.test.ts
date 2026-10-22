import { describe, it, expect } from "@jest/globals";
import { sanitizeUrlForNewRequest } from "./sanitizeUrlForNewRequest";

describe("sanitizeUrlForNewRequest", () => {
    it("keeps a valid URL unchanged", () => {
        expect(sanitizeUrlForNewRequest("{{host}}/:id?a=1&flag&b={{x}}")).toBe(
            "{{host}}/:id?a=1&flag&b={{x}}",
        );
    });

    it("removes line breaks", () => {
        expect(sanitizeUrlForNewRequest("https://a\n}\r\nfoo {")).toBe(
            "https://a}foo {",
        );
    });

    it("trims query param names and values", () => {
        expect(sanitizeUrlForNewRequest("https://a?a= 1 & b =2")).toBe(
            "https://a?a=1&b=2",
        );
    });

    it("drops query params with an empty name or a name containing a colon", () => {
        expect(sanitizeUrlForNewRequest("https://a?=foo&a:b=1&c=2")).toBe(
            "https://a?c=2",
        );
        expect(sanitizeUrlForNewRequest("https://a?=foo")).toBe("https://a");
    });
});
