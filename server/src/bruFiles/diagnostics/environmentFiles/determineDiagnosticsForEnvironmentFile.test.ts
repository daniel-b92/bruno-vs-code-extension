import { describe, it, expect } from "@jest/globals";
import {
    BrunoFileType,
    parseBruFile,
    TextDocumentHelper,
} from "../../../../../shared/index";
import { determineDiagnosticsForEnvironmentFile } from "./determineDiagnosticsForEnvironmentFile";

describe("determineDiagnosticsForEnvironmentFile", () => {
    it("parses a simple environment file string and returns diagnostics for invalid annotations", () => {
        const documentText = `vars {
  @description("first")
  @description("duplicate")
  first: 1
}`;
        const document = new TextDocumentHelper(documentText);
        const { blocks } = parseBruFile(
            document,
            BrunoFileType.EnvironmentFile,
        );

        expect(blocks).toHaveLength(1);
        expect(blocks[0].name).toBe("vars");

        const diagnostics = determineDiagnosticsForEnvironmentFile(
            "/tmp/collection/environments/invalid.bru",
            documentText,
        );

        expect(diagnostics).toHaveLength(2);
        expect(diagnostics.map((diagnostic) => diagnostic.code).sort()).toEqual(
            ["bru30", "bru30"],
        );
        expect(
            diagnostics.every(
                (diagnostic) =>
                    diagnostic.message ===
                    "An annotation is only allowed once per field",
            ),
        ).toBe(true);
    });
});
