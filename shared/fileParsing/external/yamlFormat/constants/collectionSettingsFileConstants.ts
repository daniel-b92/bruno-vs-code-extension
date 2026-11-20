export enum TopLevelCollectionSettingsProperty {
    OpenCollection = "opencollection",
    Info = "info",
    Config = "config",
    Request = "request",
    Docs = "docs",
    Bundled = "bundled",
    Extensions = "extensions",
}

export enum CollectionConfigProperty {
    Protobuf = "protobuf",
    Proxy = "proxy",
    ClientCertificates = "clientCertificates",
}

export enum ProtobufProperty {
    ProtoFiles = "protoFiles",
    ImportPaths = "importPaths",
}

export enum ProtoFileProperty {
    Type = "type",
    Path = "path",
}

export enum ProtoFileType {
    File = "file",
}

export enum ProtoImportPathProperty {
    Path = "path",
}

export enum ProxyProperty {
    Inherit = "inherit",
    Disabled = "disabled",
    Config = "config",
}

export enum ProxyConfigProperty {
    Protocol = "protocol",
    Hostname = "hostname",
    Port = "port",
    Auth = "auth",
    BypassProxy = "bypassProxy",
}

export enum ProxyProtocol {
    Http = "http",
    Https = "https",
    Socks4 = "socks4",
    Socks5 = "socks5",
}

export enum ProxyAuthProperty {
    Username = "username",
    Password = "password",
    Disabled = "disabled",
}

export enum ClientCertificateProperty {
    Domain = "domain",
    Type = "type",
    CertificateFilePath = "certificateFilePath",
    PrivateKeyFilePath = "privateKeyFilePath",
    PfxFilePath = "pfxFilePath",
    Passphrase = "passphrase",
    Disabled = "disabled",
}

export enum ClientCertificateType {
    Pem = "pem",
    Pkcs12 = "pkcs12",
}

export enum CollectionExtensionsProperty {
    Bruno = "bruno",
}

export enum BrunoExtensionProperty {
    Ignore = "ignore",
    Presets = "presets",
    Scripts = "scripts",
}

export enum BrunoScriptsProperty {
    AdditionalContextRoots = "additionalContextRoots",
}

export enum BrunoPresetsProperty {
    Request = "request",
    DefaultEnvironment = "defaultEnvironment",
}

export enum BrunoPresetsRequestProperty {
    Type = "type",
    Url = "url",
}

export enum BrunoPresetsRequestType {
    Http = "http",
    Graphql = "graphql",
    Grpc = "grpc",
    Websocket = "ws",
}
