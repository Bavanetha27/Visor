import * as vscode from 'vscode';

export class TodoProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private todos: Map<string, TodoItem[]> = new Map();
    private fileVersions: Map<string, number> = new Map();

    private filter: string = 'ALL';
    private search: string = '';

    private refreshTimeout: NodeJS.Timeout | undefined;

    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {
        this.initialScan();

        vscode.workspace.onDidSaveTextDocument(doc => this.scanSingleFile(doc));
        vscode.workspace.onDidChangeTextDocument(e => this.scanSingleFile(e.document));
    }

    async initialScan() {
        const files = await vscode.workspace.findFiles(
            '**/*',
            '**/{node_modules,.git,dist,build}/**'
        );

        for (const file of files) {
            try {
                const doc = await vscode.workspace.openTextDocument(file);
                this.processFile(doc);
            } catch {}
        }

        this.refresh();
    }

    private scanTimeouts: Map<string, NodeJS.Timeout> = new Map();

    scanSingleFile(doc: vscode.TextDocument) {

        if (doc.getText().length > 100000) return;

        if (this.fileVersions.get(doc.uri.fsPath) === doc.version) return;

        this.fileVersions.set(doc.uri.fsPath, doc.version);

        const fsPath = doc.uri.fsPath;
        if (this.scanTimeouts.has(fsPath)) {
            clearTimeout(this.scanTimeouts.get(fsPath)!);
        }

        this.scanTimeouts.set(fsPath, setTimeout(() => {
            this.processFile(doc);
            this.refresh();
        }, 500));
    }

    private processFile(doc: vscode.TextDocument) {

        const regex = /(TODO|FIXME|BUG)\s*(?:\[(HIGH|MEDIUM|LOW)\])?\s*(?:\[(.*?)\])?\s*:\s*(.*)/i;

        const items: TodoItem[] = [];
        const lines = doc.getText().split('\n');

        lines.forEach((lineText, index) => {
            const match = lineText.match(regex);

            if (match) {
                const priority = match[2] ? match[2].toUpperCase() : 'MEDIUM';
                const date = match[3] || new Date().toISOString().split('T')[0];
                const task = match[4].trim();

                items.push(new TodoItem(task, doc.uri, index, priority as any, date));
            }
        });

        this.todos.set(doc.uri.fsPath, items);
    }

    setFilter(filter: string) {
        this.filter = filter;
        this.refresh();
    }

    setSearch(keyword: string) {
        this.search = keyword.toLowerCase();
        this.refresh();
    }

    refresh() {
        if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
        this.refreshTimeout = setTimeout(() => {
            this._onDidChangeTreeData.fire();
        }, 300);
    }



    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {

        if (!element) {

            const groups: Record<string, TodoItem[]> = {
                'HIGH': [],
                'MEDIUM': [],
                'LOW': []
            };

            Array.from(this.todos.values()).flat().forEach(todo => {

                // FILTER
                if (this.filter !== 'ALL') {
                    if (this.filter === 'OVERDUE' && !todo.description?.toString().includes('Overdue')) return;
                    if (['HIGH','MEDIUM','LOW'].includes(this.filter) && todo.priority !== this.filter) return;
                }

                // SEARCH
                if (this.search && !todo.label!.toString().toLowerCase().includes(this.search)) return;

                if (todo.priority === 'HIGH') groups['HIGH'].push(todo);
                else if (todo.priority === 'MEDIUM') groups['MEDIUM'].push(todo);
                else groups['LOW'].push(todo);
            });

            return Promise.resolve(
                Object.keys(groups).map(k =>
                    new PriorityGroup(k, groups[k])
                )
            );
        }

        if (element instanceof PriorityGroup) return Promise.resolve(element.todos);

        return Promise.resolve([]);
    }
}

class PriorityGroup extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly todos: TodoItem[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Expanded
    ) {
        super(label, collapsibleState);
        this.description = `${todos.length} tasks`;
        
        if (label === 'HIGH') {
            this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('problemsErrorIcon.foreground'));
        } else if (label === 'MEDIUM') {
            this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
        } else {
            this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('problemsInfoIcon.foreground'));
        }
    }
}

class TodoItem extends vscode.TreeItem {
    constructor(
        public readonly task: string,
        public readonly file: vscode.Uri,
        public readonly line: number,
        public readonly priority: 'HIGH' | 'MEDIUM' | 'LOW',
        public readonly date: string
    ) {
        super(task, vscode.TreeItemCollapsibleState.None);

        const today = new Date();
        const deadline = new Date(date);
        const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000*60*60*24));
        const status = diff < 0 ? 'Overdue' : `${diff} days left`;
        
        const fileName = file.fsPath.split(/[\\/]/).pop();

        this.description = `${fileName}:${line + 1} • ${status}`;
        this.tooltip = `Priority: ${priority}\nDue: ${date}\nFile: ${file.fsPath}:${line + 1}`;

        if (diff < 0) {
            this.iconPath = new vscode.ThemeIcon('watch', new vscode.ThemeColor('problemsErrorIcon.foreground'));
        } else if (priority === 'HIGH') {
            this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('problemsErrorIcon.foreground'));
        } else if (priority === 'MEDIUM') {
            this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
        } else {
            this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('problemsInfoIcon.foreground'));
        }

        this.command = {
            command: 'visor.openTodo',
            title: 'Open TODO',
            arguments: [file, line]
        };
    }
}