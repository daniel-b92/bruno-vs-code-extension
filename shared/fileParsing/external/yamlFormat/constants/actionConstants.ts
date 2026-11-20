export enum ActionProperty {
    Type = "type",
    Phase = "phase",
    Selector = "selector",
    Variable = "variable",
    Description = "description",
    Disabled = "disabled",
}

export enum ActionSelectorProperty {
    Expression = "expression",
    Method = "method",
}

export enum ActionVariableProperty {
    Name = "name",
    Scope = "scope",
}

export enum ActionType {
    SetVariable = "set-variable",
}

export enum ActionPhase {
    AfterResponse = "after-response",
}

export enum ActionSelectorMethod {
    Jsonq = "jsonq",
}

export enum ActionVariableScope {
    Runtime = "runtime",
}
