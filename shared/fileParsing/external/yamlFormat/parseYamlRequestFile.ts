import {
    isMap,
    isScalar,
    LineCounter,
    parseDocument,
    Scalar,
    YAMLMap,
} from "yaml";
import {
    EnvironmentVariableProperty,
    ParsedEnvironmentVariable,
    Range,
    TextDocumentHelper,
    VariableType,
    WithKeyAndValueRange,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../..";
import { mapErrors } from "../../internal/yamlFormat/parsingErrors/mapErrors";
import { getTopLevelMapIfExists } from "../../internal/yamlFormat/yamlMaps/getTopLevelMapIfExists";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import {
    CommonParsingArgs,
    ParsedMapItems,
} from "../../internal/yamlFormat/interfaces";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForValueWithUnexpectedType } from "../../internal/yamlFormat/parsingErrors/getErrorForValueWithUnexpectedType";
import { getRangeForUnknownYamlItem } from "../../internal/yamlFormat/util/getRangeForUnknownYamlItem";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { mapFromYamlScalar } from "../../internal/yamlFormat/util/mapFromYamlScalar";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";

enum TopLevelProperty {
    Info = "info",
    Runtime = "runtime",
    settings = "settings",

    // request-type specific
    Http = "http",
    Graphql = "graphql",
    Grpc = "grpc",
    Websocket = "websocket",

    docs = "docs",
    examples = "examples",
}

interface HttpTypeSpecificProperties {
    requestDetails?: WithKeyAndValueRange<unknown>;
    examples?: WithKeyAndValueRange<unknown[]>;
}

export function parseYamlRequestFile(docHelper: TextDocumentHelper):
    | YamlParsingError[]
    | {
          common: {
              info: WithKeyAndValueRange<{
                  name?: WithKeyAndValueRange<string>;
                  type?: WithKeyAndValueRange<string>;
                  sequence?: WithKeyAndValueRange<number>;
                  description?: WithKeyAndValueRange<string>;
                  tags?: WithKeyAndValueRange<string[]>;
              }>;
              runtime: WithKeyAndValueRange<{
                  variables?: WithKeyAndValueRange<unknown[]>;
                  scripts?: WithKeyAndValueRange<string[]>;
                  assertions?: WithKeyAndValueRange<unknown[]>;
                  auth?: WithKeyAndValueRange<unknown>;
              }>;
              docs?: WithKeyAndValueRange<string>;
          };
          typeSpecific: HttpTypeSpecificProperties;
          errors: YamlParsingError[];
      } {
    const document = parseDocument(docHelper.getText(), {
        lineCounter: new LineCounter(),
    });
    const fullDocumentRange = docHelper.getTextRange();
    const commonArgs = { docHelper, fullDocumentRange };
    const collectedErrors: YamlParsingError[] = [];

    if (document.errors.length > 0) {
        // Cannot continue with a technical parsing error.
        return mapErrors(document.errors, fullDocumentRange);
    }
}
