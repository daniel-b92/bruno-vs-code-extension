import {
    ClientCertificateProperty,
    ClientCertificateType,
    ParsedCollectionSettingsFile,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

type ParsedCertificate = NonNullable<
    NonNullable<
        ParsedCollectionSettingsFile["properties"]["config"]
    >["properties"]["clientCertificates"]
>[number];

const REQUIRED_PROPERTIES_BY_TYPE: Record<
    ClientCertificateType,
    ClientCertificateProperty[]
> = {
    [ClientCertificateType.Pem]: [
        ClientCertificateProperty.CertificateFilePath,
        ClientCertificateProperty.PrivateKeyFilePath,
    ],
    [ClientCertificateType.Pkcs12]: [ClientCertificateProperty.PfxFilePath],
};

const TYPE_SPECIFIC_PROPERTIES = Object.values(
    REQUIRED_PROPERTIES_BY_TYPE,
).flat();

export function checkClientCertificatesMatchType(
    certificates: ParsedCertificate[] | undefined,
): Diagnostic[] {
    return (certificates ?? []).flatMap(({ properties }) => {
        const type = properties.type;

        if (!type || properties.disabled?.value) {
            return [];
        }
        const required = REQUIRED_PROPERTIES_BY_TYPE[type.value];
        const missing = required.filter((key) => !properties[key]);
        const notAllowed = TYPE_SPECIFIC_PROPERTIES.filter(
            (key) => !required.includes(key) && properties[key],
        );

        return [
            ...(missing.length > 0
                ? [
                      {
                          message: `Missing keys for client certificate type '${type.value}': ${missing
                              .map((key) => `'${key}'`)
                              .join(", ")}.`,
                          range: type.valueRange,
                          // A certificate without all of its required files cannot be used.
                          severity: DiagnosticSeverity.Error,
                      },
                  ]
                : []),
            ...notAllowed.map((key) => ({
                message: `Key '${key}' is not allowed for client certificate type '${type.value}'.`,
                range: properties[key]!.keyRange,
                severity: DiagnosticSeverity.Warning,
            })),
        ];
    });
}
