import * as assert from 'assert';
import * as vscode from 'vscode';
import { TodoProvider } from '../todoProvider';

suite('Visor Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('TodoProvider parses TODO comments correctly', async () => {
		const provider = new TodoProvider();
		
		// Create a mock URI and content
		const uri = vscode.Uri.file('/fake/path/app.js');
		const mockContent = `
			function test() {
				// TODO[HIGH]: Fix the login crash
				console.log("hello");
				// FIXME[LOW]: Clean up imports
				// BUG[MEDIUM][2026-12-31]: Y2K bug
			}
		`;

		// Directly invoke the parser using casting to bypass private visibility for testing
		(provider as any).processContent(uri, mockContent);

		// Get the root groups (HIGH, MEDIUM, LOW)
		const rootGroups = await provider.getChildren();
		assert.strictEqual(rootGroups.length, 3, "Should create 3 priority groups");

		// Test HIGH Priority Parsing
		const highGroup = rootGroups.find((g: any) => g.label === 'HIGH');
		assert.ok(highGroup, "HIGH group should exist");
		
		const highTodos = await provider.getChildren(highGroup);
		assert.strictEqual(highTodos.length, 1, "Should have 1 HIGH task");
		assert.strictEqual((highTodos[0] as any).task, "Fix the login crash");

		// Test MEDIUM Priority and Date Parsing
		const mediumGroup = rootGroups.find((g: any) => g.label === 'MEDIUM');
		const mediumTodos = await provider.getChildren(mediumGroup);
		assert.strictEqual(mediumTodos.length, 1, "Should have 1 MEDIUM task");
		assert.strictEqual((mediumTodos[0] as any).task, "Y2K bug");
		assert.strictEqual((mediumTodos[0] as any).date, "2026-12-31");

		// Test LOW Priority Parsing
		const lowGroup = rootGroups.find((g: any) => g.label === 'LOW');
		const lowTodos = await provider.getChildren(lowGroup);
		assert.strictEqual(lowTodos.length, 1, "Should have 1 LOW task");
		assert.strictEqual((lowTodos[0] as any).task, "Clean up imports");
	});

	test('TodoProvider handles filtering', async () => {
		const provider = new TodoProvider();
		const uri = vscode.Uri.file('/fake/path/app.js');
		const mockContent = `
			// TODO[HIGH]: High bug
			// TODO[LOW]: Low bug
		`;
		(provider as any).processContent(uri, mockContent);

		// Apply HIGH filter
		provider.setFilter('HIGH');
		
		const rootGroups = await provider.getChildren();
		const highGroup = rootGroups.find((g: any) => g.label === 'HIGH');
		const lowGroup = rootGroups.find((g: any) => g.label === 'LOW');
		
		const highTodos = await provider.getChildren(highGroup);
		const lowTodos = await provider.getChildren(lowGroup);
		
		assert.strictEqual(highTodos.length, 1, "HIGH group should still have 1 item");
		assert.strictEqual(lowTodos.length, 0, "LOW group should be filtered out to 0 items");
	});
});
