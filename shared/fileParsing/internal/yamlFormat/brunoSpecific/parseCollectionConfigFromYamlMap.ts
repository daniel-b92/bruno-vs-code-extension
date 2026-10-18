import { YAMLMap } from "yaml";
import { ParsedCollectionSettingsFile, YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { parseMapsFromSequence } from "../yamlSequences/parseMapsFromSequence";
import { parseIfPresent } from "../util/parseIfPresent";
import { getRangeForItem } from "../util/getRangeForItem";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import {
    ClientCertificateProperty,
    ClientCertificateType,
    CollectionConfigProperty,
    ProtobufProperty,
    ProtoFileProperty,
    ProtoFileType,
    ProtoImportPathProperty,
    ProxyAuthProperty,
    ProxyConfigProperty,
    ProxyProperty,
    ProxyProtocol,
} from "../../../external/yamlFormat/constants/collectionSettingsFileConstants";

type ParsedConfig = NonNullable<
    ParsedCollectionSettingsFile["properties"]["config"]
>;
type ParsedProtobuf = NonNullable<ParsedConfig["properties"]["protobuf"]>;
type ParsedProxy = NonNullable<ParsedConfig["properties"]["proxy"]>;

export function parseCollectionConfigFromYamlMap(
    { keyRange, value: configMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedConfig> {
    const errors: YamlParsingError[] = [];
    const { getMap, getSequence } = getValidatedMapItems(
        configMap,
        {
            mapValues: [
                CollectionConfigProperty.Protobuf,
                CollectionConfigProperty.Proxy,
            ],
            sequenceValues: [CollectionConfigProperty.ClientCertificates],
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(configMap, commonArgs),
            properties: {
                protobuf: parseIfPresent(
                    getMap(CollectionConfigProperty.Protobuf),
                    (protobufMap) => parseProtobuf(protobufMap, commonArgs),
                    errors,
                ),
                proxy: parseIfPresent(
                    getMap(CollectionConfigProperty.Proxy),
                    (proxyMap) => parseProxy(proxyMap, commonArgs),
                    errors,
                ),
                clientCertificates: parseIfPresent(
                    getSequence(CollectionConfigProperty.ClientCertificates),
                    ({ value: sequence }) =>
                        parseMapsFromSequence({
                            commonArgs,
                            sequence,
                            parseMap: (map, errors) =>
                                parseClientCertificate(map, commonArgs, errors),
                        }),
                    errors,
                ),
            },
        },
    };
}

function parseProtobuf(
    { keyRange, value: protobufMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedProtobuf> {
    const errors: YamlParsingError[] = [];
    const { getSequence } = getValidatedMapItems(
        protobufMap,
        { sequenceValues: Object.values(ProtobufProperty) },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(protobufMap, commonArgs),
            properties: {
                protoFiles: parseIfPresent(
                    getSequence(ProtobufProperty.ProtoFiles),
                    ({ value: sequence }) =>
                        parseMapsFromSequence({
                            commonArgs,
                            sequence,
                            parseMap: (map, errors) =>
                                parseProtoFile(map, commonArgs, errors),
                        }),
                    errors,
                ),
                importPaths: parseIfPresent(
                    getSequence(ProtobufProperty.ImportPaths),
                    ({ value: sequence }) =>
                        parseMapsFromSequence({
                            commonArgs,
                            sequence,
                            parseMap: (map, errors) =>
                                parseProtoImportPath(map, commonArgs, errors),
                        }),
                    errors,
                ),
            },
        },
    };
}

function parseProtoFile(
    map: YAMLMap,
    commonArgs: CommonParsingArgs,
    errors: YamlParsingError[],
): NonNullable<ParsedProtobuf["properties"]["protoFiles"]>[number] {
    const { getString, getEnumValue } = getValidatedMapItems(
        map,
        {
            scalars: {
                stringValues: Object.values(ProtoFileProperty),
                enumValues: {
                    [ProtoFileProperty.Type]: Object.values(ProtoFileType),
                },
            },
            mandatoryKeys: [ProtoFileProperty.Path],
        },
        commonArgs,
        errors,
    );

    return {
        valueRange: getRangeForItem(map, commonArgs),
        properties: {
            type: getEnumValue<ProtoFileType>(ProtoFileProperty.Type),
            path: stripKeyFromResult(getString(ProtoFileProperty.Path)),
        },
    };
}

function parseProtoImportPath(
    map: YAMLMap,
    commonArgs: CommonParsingArgs,
    errors: YamlParsingError[],
): NonNullable<ParsedProtobuf["properties"]["importPaths"]>[number] {
    const { getString } = getValidatedMapItems(
        map,
        {
            scalars: { stringValues: Object.values(ProtoImportPathProperty) },
            mandatoryKeys: [ProtoImportPathProperty.Path],
        },
        commonArgs,
        errors,
    );

    return {
        valueRange: getRangeForItem(map, commonArgs),
        properties: {
            path: stripKeyFromResult(getString(ProtoImportPathProperty.Path)),
        },
    };
}

function parseProxy(
    { keyRange, value: proxyMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedProxy> {
    const errors: YamlParsingError[] = [];
    const { getBoolean, getMap } = getValidatedMapItems(
        proxyMap,
        {
            scalars: {
                booleanValues: [ProxyProperty.Inherit, ProxyProperty.Disabled],
            },
            mapValues: [ProxyProperty.Config],
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(proxyMap, commonArgs),
            properties: {
                inherit: stripKeyFromResult(getBoolean(ProxyProperty.Inherit)),
                disabled: stripKeyFromResult(
                    getBoolean(ProxyProperty.Disabled),
                ),
                config: parseIfPresent(
                    getMap(ProxyProperty.Config),
                    (configMap) => parseProxyConfig(configMap, commonArgs),
                    errors,
                ),
            },
        },
    };
}

function parseProxyConfig(
    { keyRange, value: configMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<NonNullable<ParsedProxy["properties"]["config"]>> {
    const errors: YamlParsingError[] = [];
    const { getString, getEnumValue, getNumber, getMap } = getValidatedMapItems(
        configMap,
        {
            scalars: {
                stringValues: [
                    ProxyConfigProperty.Hostname,
                    ProxyConfigProperty.BypassProxy,
                ],
                enumValues: {
                    [ProxyConfigProperty.Protocol]:
                        Object.values(ProxyProtocol),
                },
                numericValues: [ProxyConfigProperty.Port],
            },
            mapValues: [ProxyConfigProperty.Auth],
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(configMap, commonArgs),
            properties: {
                protocol: getEnumValue<ProxyProtocol>(
                    ProxyConfigProperty.Protocol,
                ),
                hostname: stripKeyFromResult(
                    getString(ProxyConfigProperty.Hostname),
                ),
                port: stripKeyFromResult(getNumber(ProxyConfigProperty.Port)),
                auth: parseIfPresent(
                    getMap(ProxyConfigProperty.Auth),
                    (authMap) => parseProxyAuth(authMap, commonArgs),
                    errors,
                ),
                bypassProxy: stripKeyFromResult(
                    getString(ProxyConfigProperty.BypassProxy),
                ),
            },
        },
    };
}

function parseProxyAuth(
    { keyRange, value: authMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    NonNullable<
        NonNullable<ParsedProxy["properties"]["config"]>["properties"]["auth"]
    >
> {
    const errors: YamlParsingError[] = [];
    const { getString, getBoolean } = getValidatedMapItems(
        authMap,
        {
            scalars: {
                stringValues: [
                    ProxyAuthProperty.Username,
                    ProxyAuthProperty.Password,
                ],
                booleanValues: [ProxyAuthProperty.Disabled],
            },
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(authMap, commonArgs),
            properties: {
                username: stripKeyFromResult(
                    getString(ProxyAuthProperty.Username),
                ),
                password: stripKeyFromResult(
                    getString(ProxyAuthProperty.Password),
                ),
                disabled: stripKeyFromResult(
                    getBoolean(ProxyAuthProperty.Disabled),
                ),
            },
        },
    };
}

function parseClientCertificate(
    map: YAMLMap,
    commonArgs: CommonParsingArgs,
    errors: YamlParsingError[],
): NonNullable<ParsedConfig["properties"]["clientCertificates"]>[number] {
    const { getString, getEnumValue, getBoolean } = getValidatedMapItems(
        map,
        {
            scalars: {
                stringValues: [
                    ClientCertificateProperty.Domain,
                    ClientCertificateProperty.CertificateFilePath,
                    ClientCertificateProperty.PrivateKeyFilePath,
                    ClientCertificateProperty.PfxFilePath,
                    ClientCertificateProperty.Passphrase,
                ],
                booleanValues: [ClientCertificateProperty.Disabled],
                enumValues: {
                    [ClientCertificateProperty.Type]: Object.values(
                        ClientCertificateType,
                    ),
                },
            },
            mandatoryKeys: [
                ClientCertificateProperty.Domain,
                ClientCertificateProperty.Type,
            ],
        },
        commonArgs,
        errors,
    );

    return {
        valueRange: getRangeForItem(map, commonArgs),
        properties: {
            domain: stripKeyFromResult(
                getString(ClientCertificateProperty.Domain),
            ),
            type: getEnumValue<ClientCertificateType>(
                ClientCertificateProperty.Type,
            ),
            certificateFilePath: stripKeyFromResult(
                getString(ClientCertificateProperty.CertificateFilePath),
            ),
            privateKeyFilePath: stripKeyFromResult(
                getString(ClientCertificateProperty.PrivateKeyFilePath),
            ),
            pfxFilePath: stripKeyFromResult(
                getString(ClientCertificateProperty.PfxFilePath),
            ),
            passphrase: stripKeyFromResult(
                getString(ClientCertificateProperty.Passphrase),
            ),
            disabled: stripKeyFromResult(
                getBoolean(ClientCertificateProperty.Disabled),
            ),
        },
    };
}
