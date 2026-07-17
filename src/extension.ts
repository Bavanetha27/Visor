import * as vscode from 'vscode';
import { TodoProvider } from './todoProvider';

export function activate(context: vscode.ExtensionContext) {

    // console.log("Visor Activated 🚀");

    const provider = new TodoProvider();

    vscode.window.registerTreeDataProvider('visorTodos', provider);

    // Open TODO
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.openTodo', (file: vscode.Uri, line: number) => {
            vscode.workspace.openTextDocument(file).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    const lineText = doc.lineAt(line).text;
                    const startPos = new vscode.Position(line, lineText.length - lineText.trimStart().length);
                    const endPos = new vscode.Position(line, lineText.length);
                    editor.selection = new vscode.Selection(startPos, endPos);
                    editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
                });
            });
        })
    );

    // Refresh
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.refresh', () => provider.refresh())
    );

    // Add TODO
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.addTodo', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {return;}

            const task = await vscode.window.showInputBox({ prompt: "Enter TODO task description" });
            if (!task) {return;}

            const prioritySelection = await vscode.window.showQuickPick([
                { label: '$(error) HIGH', description: 'Critical priority task', value: 'HIGH' },
                { label: '$(warning) MEDIUM', description: 'Normal priority task', value: 'MEDIUM' },
                { label: '$(info) LOW', description: 'Low priority task', value: 'LOW' }
            ], { placeHolder: 'Select Priority' });
            if (!prioritySelection) {return;}
            const priority = prioritySelection.value;

            const date = new Date().toISOString().split('T')[0];

            editor.edit(edit => {
                const langId = editor.document.languageId;
                let prefix = "//";
                let suffix = "";

                if (['python', 'ruby', 'yaml', 'shellscript', 'powershell'].includes(langId)) {
                    prefix = "#";
                } else if (['html', 'xml', 'markdown'].includes(langId)) {
                    prefix = "<!--";
                    suffix = " -->";
                } else if (['css'].includes(langId)) {
                    prefix = "/*";
                    suffix = " */";
                }

                edit.insert(editor.selection.active, `\n${prefix} TODO[${priority}][${date}]: ${task}${suffix}`);
            });
        })
    );

    // Filter
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.setFilter', async () => {
            const filterSelection = await vscode.window.showQuickPick([
                { label: '$(list-flat) ALL', value: 'ALL' },
                { label: '$(error) HIGH', value: 'HIGH' },
                { label: '$(warning) MEDIUM', value: 'MEDIUM' },
                { label: '$(info) LOW', value: 'LOW' },
                { label: '$(watch) OVERDUE', value: 'OVERDUE' }
            ], { placeHolder: 'Filter Visor TODOs' });
            
            if (filterSelection) {provider.setFilter(filterSelection.value);}
        })
    );

    // Search
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.searchTodo', async () => {
            const keyword = await vscode.window.showInputBox({ 
                prompt: "Search TODOs",
                placeHolder: "Enter keyword..." 
            });
            provider.setSearch(keyword || '');
        })
    );

    // Mark as Done
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.markDone', async (node: any) => {
            if (!node || !node.file || node.line === undefined) {return;}
            const doc = await vscode.workspace.openTextDocument(node.file);
            const line = doc.lineAt(node.line);
            
            const config = vscode.workspace.getConfiguration('visor');
            const tags = config.get<string[]>('tags', ['TODO', 'FIXME', 'BUG']);
            const tagsPattern = tags.join('|');
            const regex = new RegExp(`(${tagsPattern})`, 'i');
            
            const newLineText = line.text.replace(regex, 'DONE');
            
            const edit = new vscode.WorkspaceEdit();
            edit.replace(node.file, line.range, newLineText);
            await vscode.workspace.applyEdit(edit);
            await doc.save();
        })
    );

    // Delete TODO
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.deleteTodo', async (node: any) => {
            if (!node || !node.file || node.line === undefined) {return;}
            const doc = await vscode.workspace.openTextDocument(node.file);
            const line = doc.lineAt(node.line);
            
            const edit = new vscode.WorkspaceEdit();
            edit.delete(node.file, line.rangeIncludingLineBreak);
            await vscode.workspace.applyEdit(edit);
            await doc.save();
        })
    );

    // Delete All Done
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.deleteAllDone', async (group: any) => {
            if (!group || !group.todos) {return;}
            const edit = new vscode.WorkspaceEdit();
            const docsToSave = new Set<vscode.TextDocument>();

            const todosByFile = new Map<string, any[]>();
            for (const todo of group.todos) {
                const fsPath = todo.file.fsPath;
                if (!todosByFile.has(fsPath)) {
                    todosByFile.set(fsPath, []);
                }
                todosByFile.get(fsPath)!.push(todo);
            }

            for (const [fsPath, todos] of todosByFile.entries()) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fsPath));
                docsToSave.add(doc);
                
                for (const todo of todos) {
                    const line = doc.lineAt(todo.line);
                    edit.delete(todo.file, line.rangeIncludingLineBreak);
                }
            }

            await vscode.workspace.applyEdit(edit);
            for (const doc of docsToSave) {
                await doc.save();
            }
        })
    );

    // Inline Decorations
    const highDecoration = vscode.window.createTextEditorDecorationType({
        color: new vscode.ThemeColor('problemsErrorIcon.foreground'),
        fontWeight: 'bold'
    });
    const mediumDecoration = vscode.window.createTextEditorDecorationType({
        color: new vscode.ThemeColor('problemsWarningIcon.foreground'),
        fontWeight: 'bold'
    });
    const lowDecoration = vscode.window.createTextEditorDecorationType({
        color: new vscode.ThemeColor('problemsInfoIcon.foreground'),
        fontWeight: 'bold'
    });

    let decorationTimeout: any;

    function updateDecorations() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const config = vscode.workspace.getConfiguration('visor');
        const tags = config.get<string[]>('tags', ['TODO', 'FIXME', 'BUG']);
        const tagsPattern = tags.join('|');
        const regex = new RegExp(`(${tagsPattern})\\s*(?:\\[(HIGH|MEDIUM|LOW)\\])?`, 'gi');

        const text = editor.document.getText();
        const highs: vscode.DecorationOptions[] = [];
        const mediums: vscode.DecorationOptions[] = [];
        const lows: vscode.DecorationOptions[] = [];

        let match;
        while ((match = regex.exec(text))) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);
            const decoration = { range: new vscode.Range(startPos, endPos) };

            const priority = match[2] ? match[2].toUpperCase() : 'MEDIUM';
            if (priority === 'HIGH') {highs.push(decoration);}
            else if (priority === 'MEDIUM') {mediums.push(decoration);}
            else {lows.push(decoration);}
        }

        editor.setDecorations(highDecoration, highs);
        editor.setDecorations(mediumDecoration, mediums);
        editor.setDecorations(lowDecoration, lows);
    }

    function triggerUpdateDecorations(throttle = false) {
        if (decorationTimeout) {clearTimeout(decorationTimeout);}
        if (throttle) {
            decorationTimeout = setTimeout(updateDecorations, 500);
        } else {
            updateDecorations();
        }
    }

    vscode.window.onDidChangeActiveTextEditor(() => triggerUpdateDecorations(false), null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            triggerUpdateDecorations(true);
        }
    }, null, context.subscriptions);

    triggerUpdateDecorations();
}

export function deactivate() {}