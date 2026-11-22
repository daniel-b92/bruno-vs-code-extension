import {
    getIgnoredKeysForOAuth2Flow,
    AuthType,
    ParsedAuth,
    Position,
    Range,
    TextDocumentHelper,
    YamlMapDescriptor,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { YamlDiagnosticCode } from "../yamlDiagnosticCodeEnum";
import { findAuthMapDescriptor } from "./findAuthMapDescriptor";

/** The data attached to the diagnostics for ignored keys. */
export interface IgnoredOAuth2KeyDiagnosticData {
    /** The reported key, with the parent key for nested keys (e.g. `credentials.clientSecret`). */
    key: string;
    /** The lines that define the key (including its nested content). Removing it removes the key. */
    removalRange: Range;
}

/**
 * Bruno only reads the keys of an `oauth2` auth that belong to the selected flow.
 * All other keys have no effect and get dropped the next time Bruno saves the file.
 */
export function checkOAuth2KeysMatchFlow(
    auth: ParsedAuth | undefined,
    mapDescriptors: YamlMapDescriptor[],
    docHelper: TextDocumentHelper,
): Diagnostic[] {
    // Auth that is inherited has no properties.
    if (!auth || !("properties" in auth.value)) {
        return [];
    }
    const { properties } = auth.value;
    if (properties.type.value != AuthType.Oauth2 || !("flow" in properties)) {
        return [];
    }
    const flow = properties.flow?.value;
    const authMapDescriptor = flow
        ? findAuthMapDescriptor(properties, mapDescriptors)
        : undefined;
    if (!flow || !authMapDescriptor) {
        return [];
    }

    return getIgnoredKeysForOAuth2Flow(flow).flatMap(({ key, childKey }) => {
        const keyPath = childKey ? `${key}.${childKey}` : key;
        const definedKey = authMapDescriptor.definedKeys.find(
            (defined) => defined.key == key,
        );
        const definedChildKey =
            childKey && definedKey?.valueRange
                ? findKeyWithinRange(
                      mapDescriptors,
                      childKey,
                      definedKey.valueRange,
                  )
                : undefined;
        const reported = childKey ? definedChildKey : definedKey;

        return reported
            ? [
                  {
                      message: `Key '${keyPath}' is ignored by Bruno for flow '${flow}'.`,
                      range: reported.keyRange,
                      severity: DiagnosticSeverity.Warning,
                      code: YamlDiagnosticCode.IgnoredOAuth2Key,
                      data: {
                          key: keyPath,
                          removalRange: getLinesToRemove(
                              reported.keyRange,
                              reported.valueRange,
                              docHelper,
                          ),
                      } satisfies IgnoredOAuth2KeyDiagnosticData,
                  },
              ]
            : [];
    });
}

function findKeyWithinRange(
    mapDescriptors: YamlMapDescriptor[],
    key: string,
    range: Range,
) {
    return mapDescriptors
        .flatMap(({ definedKeys }) => definedKeys)
        .find(
            (defined) =>
                defined.key == key &&
                range.contains(defined.keyRange.start) &&
                range.contains(defined.keyRange.end),
        );
}

/** Whole lines are removed, so that no empty line is left behind. */
function getLinesToRemove(
    keyRange: Range,
    valueRange: Range | undefined,
    docHelper: TextDocumentHelper,
): Range {
    const end = valueRange?.end ?? keyRange.end;
    // An end at the start of a line means that the line itself does not belong to the key.
    const lastLine =
        end.character == 0 && end.line > keyRange.start.line
            ? end.line - 1
            : end.line;
    const start = new Position(keyRange.start.line, 0);

    return lastLine + 1 < docHelper.getLineCount()
        ? new Range(start, new Position(lastLine + 1, 0))
        : new Range(
              start,
              new Position(lastLine, docHelper.getLineByIndex(lastLine).length),
          );
}
