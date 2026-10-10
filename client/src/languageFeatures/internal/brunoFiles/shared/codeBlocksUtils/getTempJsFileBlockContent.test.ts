import { describe, it, expect } from "@jest/globals";
import { EndOfLine } from "vscode";
import { BrunoFileType } from "@global_shared";
import { getTempJsFileContentForBruFile } from "./getTempJsFileContentForBruFile";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

describe("getTempJsFileBlockContent", () => {
    it("finds the content of each code block in the generated temp js file", () => {
        const tempJsContent = getTempJsContent(`meta {
  name: test
  type: grpc
}

script:grpc:before-call-start {
  bru.setVar("a", 1);
}

script:grpc:before-message-send {
  const x = { y: 1 };
  await Promise.resolve(x);
}
`);

        expect(
            getTempJsFileBlockContent(
                tempJsContent,
                "script:grpc:before-call-start",
            )?.content,
        ).toBe('  bru.setVar("a", 1);\n');
        expect(
            getTempJsFileBlockContent(
                tempJsContent,
                "script:grpc:before-message-send",
            )?.content,
        ).toBe("  const x = { y: 1 };\n  await Promise.resolve(x);\n");
    });

    it("returns undefined for blocks that are not part of the temp js file", () => {
        const tempJsContent = getTempJsContent(
            "meta {\n  name: test\n  type: grpc\n}\n\ntests {\n  asd\n}\n",
        );

        expect(
            getTempJsFileBlockContent(tempJsContent, "script:pre-request"),
        ).toBeUndefined();
    });

    it("does not declare any named functions for the code blocks", () => {
        const tempJsContent = getTempJsContent(
            "meta {\n  name: test\n  type: grpc\n}\n\nscript:grpc:before-call-start {\n  asd\n}\n",
        );

        expect(tempJsContent).not.toMatch(
            /function\s+script_grpc_before_call_start/,
        );
    });
});

function getTempJsContent(bruFileContent: string) {
    return getTempJsFileContentForBruFile(
        bruFileContent,
        EndOfLine.LF,
        BrunoFileType.RequestFile,
    );
}
