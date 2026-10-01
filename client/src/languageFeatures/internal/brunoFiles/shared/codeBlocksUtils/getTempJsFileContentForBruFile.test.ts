import { describe, it, expect } from "@jest/globals";
import { EndOfLine } from "vscode";
import { BrunoFileType } from "@global_shared";
import { getTempJsFileContentForBruFile } from "./getTempJsFileContentForBruFile";

describe("getTempJsFileContentForBruFile", () => {
    it("only includes `bru` (with `grpc`) for GRPC requests", () => {
        const content = getContentForRequestOfType("grpc");

        expect(content).toContain("const bru = {");
        expect(content).toContain("grpc: {");
        expect(content).not.toContain("const req =");
        expect(content).not.toContain("const res =");
    });

    it.each(["http", "graphql"])(
        "includes `req` and `res` but no `bru.grpc` for %s requests",
        (type) => {
            const content = getContentForRequestOfType(type);

            expect(content).toContain("const bru = {");
            expect(content).toContain("const req =");
            expect(content).toContain("const res =");
            expect(content).not.toContain("grpc: {");
        },
    );

    it("restricts `bru.grpc` to `request` / `response` depending on the execution group", () => {
        const content = getTempJsFileContentForBruFile(
            `meta {
  name: test
  type: grpc
}

script:grpc:before-call-start {
  bru.setVar("a", 1);
}

script:grpc:after-call-end {
  bru.setVar("a", 1);
}
`,
            EndOfLine.LF,
            BrunoFileType.RequestFile,
        );

        expect(content).toMatch(
            /function \w*before_call_start\w*\(\/\*\* @type \{BruForPreRequestGrpc\} \*\/ bru\) \{/,
        );
        expect(content).toMatch(
            /function \w*after_call_end\w*\(\/\*\* @type \{BruForPostResponseGrpc\} \*\/ bru\) \{/,
        );
    });

    it("includes all definitions if the request type is unknown", () => {
        const content = getTempJsFileContentForBruFile(
            "meta {\n  name: test\n}\n",
            EndOfLine.LF,
            BrunoFileType.RequestFile,
        );

        expect(content).toContain("grpc: {");
        expect(content).toContain("const req =");
        expect(content).toContain("const res =");
    });
});

function getContentForRequestOfType(type: string) {
    return getTempJsFileContentForBruFile(
        `meta {\n  name: test\n  type: ${type}\n}\n`,
        EndOfLine.LF,
        BrunoFileType.RequestFile,
    );
}
