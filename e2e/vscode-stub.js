// Minimal 'vscode' module stub so the extension's real connection classes can be
// loaded and exercised outside the VS Code host. Only module-load-time surface
// needs to be real; the connection classes themselves touch none of it.
const noop = () => {};
class Disposable { dispose() {} }
class TreeItem {
  constructor(label, state) { this.label = label; this.collapsibleState = state; }
}
class EventEmitterStub {
  constructor() { this.event = () => new Disposable(); }
  fire() {} dispose() {}
}
class Uri {
  static file(p) { return { fsPath: p, path: p, scheme: 'file', toString: () => p }; }
  static parse(p) { return { fsPath: p, path: p, toString: () => p }; }
}
class ThemeIcon { constructor(id) { this.id = id; } }

const real = {
  Disposable, TreeItem, EventEmitter: EventEmitterStub, Uri, ThemeIcon,
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ProgressLocation: { Notification: 15, Window: 10 },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
  ViewColumn: { One: 1, Two: 2, Active: -1 },
  window: {
    createOutputChannel: () => ({ show: noop, appendLine: noop, append: noop, dispose: noop }),
    showErrorMessage: () => Promise.resolve(undefined),
    showInformationMessage: () => Promise.resolve(undefined),
    showWarningMessage: () => Promise.resolve(undefined),
    showQuickPick: () => Promise.resolve(undefined),
    showInputBox: () => Promise.resolve(undefined),
    showOpenDialog: () => Promise.resolve(undefined),
    createStatusBarItem: () => ({ show: noop, hide: noop, dispose: noop, text: '' }),
    createTerminal: () => ({ sendText: noop, show: noop, dispose: noop }),
    createTreeView: () => ({ dispose: noop, onDidChangeSelection: () => new Disposable() }),
    withProgress: (_o, task) => task({ report: noop }, { isCancellationRequested: false }),
    activeTextEditor: undefined,
  },
  workspace: {
    getConfiguration: () => ({ get: (_k, d) => d, update: () => Promise.resolve() }),
    onDidChangeConfiguration: () => new Disposable(),
    onDidSaveTextDocument: () => new Disposable(),
    workspaceFolders: undefined,
    fs: { readFile: () => Promise.resolve(Buffer.alloc(0)) },
  },
  commands: { registerCommand: () => new Disposable(), executeCommand: () => Promise.resolve() },
  languages: { registerCompletionItemProvider: () => new Disposable(), registerCodeLensProvider: () => new Disposable() },
  env: { machineId: 'stub', language: 'en', appName: 'stub', openExternal: () => Promise.resolve(true), clipboard: { writeText: noop } },
  extensions: { getExtension: () => ({ extensionPath: process.env.EXT_PATH || process.cwd(), packageJSON: { version: "1.0.0" } }) },
  version: '1.90.0',
};


// esbuild interop copies own enumerable keys, which bypasses the Proxy fallback,
// so every class the extension constructs at module-load time is declared here.
for (const n of ["Position","Range","Selection","MarkdownString","CompletionItem","CodeLens",
                 "ThemeColor","RelativePattern","CancellationTokenSource","Location","Diagnostic",
                 "SnippetString","DocumentLink","Hover","SignatureHelp","ParameterInformation",
                 "SignatureInformation","CodeAction","WorkspaceEdit","FileSystemError","DataTransferItem"]) {
  real[n] = class { constructor(...a) { this.args = a; } };
}
for (const n of ["CompletionItemKind","SymbolKind","DiagnosticSeverity","CodeActionKind",
                 "TextEditorRevealType","EndOfLine","FileType","UIKind","QuickPickItemKind"]) {
  real[n] = new Proxy({}, { get: () => 0 });
}

// Anything not modelled above resolves to a harmless callable/constructible stub,
// so a missing member can never crash module loading.
const fallback = new Proxy(function () {}, {
  get: () => fallback, apply: () => fallback, construct: () => ({}),
});
module.exports = new Proxy(real, {
  get: (t, k) => (k in t ? t[k] : fallback),
});
