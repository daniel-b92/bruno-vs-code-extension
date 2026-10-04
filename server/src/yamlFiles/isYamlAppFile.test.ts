import { isYamlAppFile } from "./isYamlAppFile";

describe("isYamlAppFile", () => {
    it("should return true if the info type is 'app'", () => {
        expect(isYamlAppFile("info:\n  name: a\n  type: app\ncode: foo")).toBe(
            true,
        );
    });

    it.each([
        ["a request type", "info:\n  name: a\n  type: http\nhttp:\n  url: x"],
        ["no type", "info:\n  name: a"],
        ["no info section", "code: foo"],
        ["invalid yaml syntax", "info: ["],
        ["empty content", ""],
    ])("should return false for %s", (_, text) => {
        expect(isYamlAppFile(text)).toBe(false);
    });
});
