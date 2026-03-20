import * as vscode from 'vscode';
import { TodoProvider } from './todoProvider';

export function activate(context: vscode.ExtensionContext) {

    console.log("Visor Activated");

    // Create the provider
    const provider = new TodoProvider();

    // Register TreeView in Explorer sidebar
    vscode.window.registerTreeDataProvider('visorTodos', provider);

    // Command: open file at line
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.openTodo', (file: vscode.Uri, line: number) => {
            vscode.workspace.openTextDocument(file).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    const pos = new vscode.Position(line, 0);
                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(new vscode.Range(pos, pos));
                });
            });
        })
    );

    // Command: manual refresh
    context.subscriptions.push(
        vscode.commands.registerCommand('visor.refreshTodos', () => provider.refresh())
    );
}

export function deactivate() {}