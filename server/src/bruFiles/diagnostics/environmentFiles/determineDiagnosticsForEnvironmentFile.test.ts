import { describe, it, expect } from "@jest/globals";
import {
    BrunoFileType,
    parseBruFile,
    TextDocumentHelper,
} from "@global_shared";
import { determineDiagnosticsForEnvironmentFile } from "./determineDiagnosticsForEnvironmentFile";
import { NonBlockSpecificDiagnosticCode } from "../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";

describe("determineDiagnosticsForEnvironmentFile", () => {
    it("parses a simple environment file string and returns diagnostics for duplicate annotations", () => {
        const documentText = `vars {
  @description("first")
  @number
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
            [
                NonBlockSpecificDiagnosticCode.DuplicateAnnotationOfSameSortInDictionaryBlock,
                NonBlockSpecificDiagnosticCode.DuplicateAnnotationOfSameSortInDictionaryBlock,
            ],
        );
        expect(diagnostics.map(({ range }) => range.start.line).sort()).toEqual(
            [1, 3],
        );
    });

    it("parses a simple environment file string and returns diagnostics for annotations before non simple field", () => {
        const documentText = `vars {
  @description("first")
  first: 1
  @description("invalid")
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

        expect(diagnostics).toHaveLength(1);
        const diagnostic = diagnostics[0];
        expect(diagnostic.code).toEqual(
            NonBlockSpecificDiagnosticCode.AnnotationBeforeNonSimpleFieldInDictionaryBlock,
        );
        expect(diagnostic.range.start.line).toEqual(3);
    });

    it("parses a simple environment file string and does not return diagnostic for valid annotations", () => {
        const documentText = `vars {
  @description("first")
  @number
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

        expect(diagnostics).toHaveLength(0);
    });

    it("does not flag a valid top level 'extends' field as text outside of blocks", () => {
        const documentText = `extends: Base

vars {
  first: 1
}`;

        const diagnostics = determineDiagnosticsForEnvironmentFile(
            "/tmp/collection/environments/valid.bru",
            documentText,
        );

        expect(diagnostics).toHaveLength(0);
    });

    it("returns a diagnostic when the 'extends' field has no value", () => {
        const documentText = `extends:

vars {
  first: 1
}`;

        const diagnostics = determineDiagnosticsForEnvironmentFile(
            "/tmp/collection/environments/invalid.bru",
            documentText,
        );

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].code).toEqual(
            RelevantWithinEnvironmentFileDiagnosticCode.InvalidExtendsField,
        );
    });

    it("returns a diagnostic when the 'extends' field references its own environment", () => {
        const documentText = `extends: invalid

vars {
  first: 1
}`;

        const diagnostics = determineDiagnosticsForEnvironmentFile(
            "/tmp/collection/environments/invalid.bru",
            documentText,
        );

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].code).toEqual(
            RelevantWithinEnvironmentFileDiagnosticCode.InvalidExtendsField,
        );
    });

    it("returns a diagnostic for each 'extends' field definition after the first one", () => {
        const documentText = `extends: Base
extends: Other
extends: Third

vars {
  first: 1
}`;

        const diagnostics = determineDiagnosticsForEnvironmentFile(
            "/tmp/collection/environments/invalid.bru",
            documentText,
        );

        expect(diagnostics).toHaveLength(2);
        expect(
            diagnostics.every(
                ({ code }) =>
                    code ==
                    RelevantWithinEnvironmentFileDiagnosticCode.ExtendsFieldDefinedMultipleTimes,
            ),
        ).toBe(true);
        expect(diagnostics.map(({ range }) => range.start.line).sort()).toEqual(
            [1, 2],
        );
    });
});
