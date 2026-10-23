import {
    LineBreakType,
    ParsedHttpParam,
    Position,
    Range,
    TextDocumentHelper,
    getYamlIndentationStep,
    HttpParamType,
} from "@global_shared";
import { stringify } from "yaml";
import { TextEdit } from "vscode-languageserver";
import { YamlUrlParamsInfo } from "./getYamlUrlParamsInfo";

export interface NewParam {
    name: string;
    value: string;
    type: HttpParamType;
}

export interface ParamChanges {
    remove: ParsedHttpParam[];
    add: NewParam[];
    /** If defined and removed, the new entries take its place. Otherwise, they are appended to the existing entries. */
    addInPlaceOf?: ParsedHttpParam;
}

/**
 * Applies the changes to the entries of `params` with targeted edits, so that comments and formatting of the file are kept.
 * Removes the whole `params` key, if no entries would be left.
 *
 * @returns No edits, if the structure of the file is not supported (e.g. `params` written as flow sequence).
 */
export function applyParamChanges(
    docHelper: TextDocumentHelper,
    info: YamlUrlParamsInfo,
    changes: ParamChanges[],
): TextEdit[] {
    const remove = changes.flatMap((c) => c.remove);
    const add = changes.flatMap((c) => c.add);
    const addInPlaceOf = changes.find(
        ({ addInPlaceOf }) => addInPlaceOf && remove.includes(addInPlaceOf),
    )?.addInPlaceOf;

    if (remove.length == 0 && add.length == 0) {
        return [];
    }

    // New entries can only be written in block style, so a `http` section in flow style (`{...}`) is not supported.
    if (isFlowMap(docHelper, info.http.valueRange)) {
        return [];
    }

    const context = {
        docHelper,
        info,
        lineBreak: docHelper.getMostUsedLineBreak() ?? LineBreakType.Lf,
    };

    if (!info.params) {
        return add.length > 0 && !hasParamsKey(docHelper, info)
            ? [insertNewParamsKey(context, add)]
            : [];
    }

    if (info.params.isFlowSequence) {
        return [];
    }

    if (info.allEntries.length > 0 && !hasDashBeforeEveryEntry(context)) {
        return [];
    }

    if (add.length == 0 && info.allEntries.every((e) => remove.includes(e))) {
        return [removeParamsKey(context)];
    }

    const { propertyColumn, dashColumn } = getEntryColumns(context);
    const newEntriesText = add
        .map((param) => getTextForEntry(param, dashColumn, propertyColumn))
        .map((lines) => lines.join(context.lineBreak) + context.lineBreak)
        .join("");

    const edits = remove.map((entry) =>
        entry == addInPlaceOf && newEntriesText
            ? TextEdit.replace(
                  getLinesRange(entry),
                  // The last line of the document might not end with a line break.
                  getLastLineOfRange(entry.valueRange) + 1 <
                      docHelper.getLineCount()
                      ? newEntriesText
                      : newEntriesText.slice(0, -context.lineBreak.length),
              )
            : TextEdit.del(getLinesRange(entry)),
    );

    if (newEntriesText && !addInPlaceOf) {
        edits.push(
            insertLinesAfter(
                context,
                getLastLineOfRange(info.params.valueRange),
                newEntriesText,
            ),
        );
    }

    return edits;
}

interface EditContext {
    docHelper: TextDocumentHelper;
    info: YamlUrlParamsInfo;
    lineBreak: LineBreakType;
}

function isFlowMap(docHelper: TextDocumentHelper, { start }: Range) {
    return docHelper.getLineByIndex(start.line)[start.character] == "{";
}

function insertNewParamsKey(context: EditContext, add: NewParam[]): TextEdit {
    const { info, lineBreak, docHelper } = context;
    const keyColumn = info.url.keyRange.start.character;
    const dashColumn = keyColumn + getYamlIndentationStep(docHelper);
    const lines = [
        `${" ".repeat(keyColumn)}params:`,
        ...add.flatMap((param) =>
            getTextForEntry(param, dashColumn, dashColumn + DASH_WIDTH),
        ),
    ];

    return insertLinesAfter(
        context,
        getLastLineOfRange(info.http.valueRange),
        lines.join(lineBreak) + lineBreak,
    );
}

function removeParamsKey({ info, docHelper }: EditContext) {
    const keyLine = info.params!.keyRange.start.line;
    const lastLine = getLastLineOfRange(info.params!.valueRange);

    return TextEdit.del(
        new Range(
            new Position(keyLine, 0),
            lastLine + 1 < docHelper.getLineCount()
                ? new Position(lastLine + 1, 0)
                : new Position(
                      lastLine,
                      docHelper.getLineByIndex(lastLine).length,
                  ),
        ),
    );
}

/** The key could also exist with a value that is not a valid sequence. In that case, the file must not be touched. */
function hasParamsKey(
    docHelper: TextDocumentHelper,
    { http, url }: YamlUrlParamsInfo,
) {
    const keyColumn = url.keyRange.start.character;

    return docHelper
        .getAllLines(http.valueRange.start.line)
        .filter(({ index }) => index <= http.valueRange.end.line)
        .some(({ content }) =>
            new RegExp(`^ {${keyColumn}}params\\s*:`).test(content),
        );
}

function hasDashBeforeEveryEntry({ docHelper, info }: EditContext) {
    return info.allEntries.every(({ valueRange: { start } }) =>
        /^\s*-\s+$/.test(
            docHelper.getLineByIndex(start.line).slice(0, start.character),
        ),
    );
}

function getEntryColumns({ docHelper, info }: EditContext) {
    const firstEntryStart = info.allEntries[0]?.valueRange.start;

    if (!firstEntryStart) {
        const dashColumn =
            info.params!.keyRange.start.character +
            getYamlIndentationStep(docHelper);

        return { dashColumn, propertyColumn: dashColumn + DASH_WIDTH };
    }

    return {
        propertyColumn: firstEntryStart.character,
        dashColumn: docHelper.getLineByIndex(firstEntryStart.line).indexOf("-"),
    };
}

function getTextForEntry(
    { name, value, type }: NewParam,
    dashColumn: number,
    propertyColumn: number,
) {
    const propertyIndent = " ".repeat(propertyColumn);

    return [
        `${" ".repeat(dashColumn)}- name: ${toYamlScalar(name)}`,
        `${propertyIndent}value: ${toYamlScalar(value)}`,
        `${propertyIndent}type: ${type}`,
    ];
}

/** Quotes the scalar if necessary, so that e.g. the value `1` stays a string. */
export function toYamlScalar(value: string) {
    return stringify(value, { lineWidth: 0 }).trimEnd();
}

/** Whole lines of an entry, including the line break of the last line. */
function getLinesRange({ valueRange }: ParsedHttpParam) {
    return new Range(
        new Position(valueRange.start.line, 0),
        new Position(getLastLineOfRange(valueRange) + 1, 0),
    );
}

/** A range that ends at the start of a line does not include that line. */
function getLastLineOfRange({ start, end }: Range) {
    return end.character == 0 && end.line > start.line
        ? end.line - 1
        : end.line;
}

function insertLinesAfter(
    { docHelper, lineBreak }: EditContext,
    line: number,
    textWithTrailingLineBreak: string,
) {
    // The last line of the document might not end with a line break.
    return line + 1 < docHelper.getLineCount()
        ? TextEdit.insert(new Position(line + 1, 0), textWithTrailingLineBreak)
        : TextEdit.insert(
              new Position(line, docHelper.getLineByIndex(line).length),
              lineBreak + textWithTrailingLineBreak.slice(0, -lineBreak.length),
          );
}

const DASH_WIDTH = 2;
