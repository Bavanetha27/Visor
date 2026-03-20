import * as vscode from 'vscode';

export class TodoProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private todos: Map<string, TodoItem[]> = new Map();
    private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

    constructor() {
        this.initialScan();

        vscode.workspace.onDidSaveTextDocument(doc => this.scanSingleFile(doc));
        vscode.workspace.onDidChangeTextDocument(e => this.scanSingleFile(e.document));
        vscode.workspace.onDidDeleteFiles(e => {
            e.files.forEach(f => this.todos.delete(f.fsPath));
            this.refresh();
        });
    }

    async initialScan() {
        const files = await vscode.workspace.findFiles(
            '**/*',
            '**/{node_modules,.git,dist,build,out,coverage,.next,venv,__pycache__}/**'
        );

        for (const file of files) {
            try {
                const doc = await vscode.workspace.openTextDocument(file);
                this.processFile(doc);
            } catch (err) {
                console.log("Error reading file:", file.fsPath);
            }
        }

        this.refresh();
    }

    scanSingleFile(doc: vscode.TextDocument) {
        // Skip huge files (>100k chars)
        if (doc.getText().length > 100000) return;
        this.processFile(doc);
        this.refresh();
    }

    private processFile(doc: vscode.TextDocument) {
        const regex = /TODO\[(HIGH|MEDIUM|LOW)\]\[(.*?)\]\s*:\s*(.*)/i;
        const items: TodoItem[] = [];

        const lines = doc.getText().split('\n');
        lines.forEach((lineText, index) => {
            const match = lineText.match(regex);
            if (match) {
                const [_, priority, date, task] = match;
                const label = this.formatLabel(priority.toUpperCase(), date, task);
                items.push(new TodoItem(label, doc.uri, index, priority.toUpperCase() as 'HIGH'|'MEDIUM'|'LOW', date));
            }
        });

        this.todos.set(doc.uri.fsPath, items);
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    formatLabel(priority: string, date: string, task: string): string {
        const today = new Date();
        const deadline = new Date(date);
        const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000*60*60*24));
        const status = diff < 0 ? '❌ Overdue' : `⏳ ${diff} days left`;
        return `${this.getPriorityIcon(priority)} ${task} (${status})`;
    }

    getPriorityIcon(priority: string) {
        return priority === 'HIGH' ? '🔴' :
               priority === 'MEDIUM' ? '🟡' : '🟢';
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            // Top-level groups
            const groups: Record<string, TodoItem[]> = { '🔴 HIGH': [], '🟡 MEDIUM': [], '🟢 LOW': [] };
            Array.from(this.todos.values()).flat().forEach(todo => {
                if (todo.priority === 'HIGH') groups['🔴 HIGH'].push(todo);
                else if (todo.priority === 'MEDIUM') groups['🟡 MEDIUM'].push(todo);
                else groups['🟢 LOW'].push(todo);
            });

            // Sort by date
            Object.keys(groups).forEach(k => {
                groups[k].sort((a,b) => this.getDaysLeft(a.date) - this.getDaysLeft(b.date));
            });

            return Promise.resolve(
                Object.keys(groups).map(k => new PriorityGroup(`${k} (${groups[k].length})`, groups[k]))
            );
        }

        if (element instanceof PriorityGroup) return Promise.resolve(element.todos);

        return Promise.resolve([]);
    }

    private getDaysLeft(dateStr: string) {
        const today = new Date();
        const deadline = new Date(dateStr);
        const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000*60*60*24));
        return diff < 0 ? -1 : diff;
    }
}

// Collapsible priority group
class PriorityGroup extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly todos: TodoItem[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
    ) {
        super(label, collapsibleState);
    }
}

// Individual TODO
class TodoItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly file: vscode.Uri,
        public readonly line: number,
        public readonly priority: 'HIGH' | 'MEDIUM' | 'LOW',
        public readonly date: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: 'visor.openTodo',
            title: 'Open TODO',
            arguments: [file, line]
        };
    }

    get priorityIcon() {
        return this.priority === 'HIGH' ? '🔴' :
               this.priority === 'MEDIUM' ? '🟡' : '🟢';
    }
}