# Visor: Smart TODO Manager for VS Code

Visor is a powerful, integrated task manager for Visual Studio Code that seamlessly extracts, organizes, and tracks `TODO`, `FIXME`, and `BUG` comments directly from your codebase. Keep your workflow focused by managing your tasks right where you write your code.

## 🚀 Features

- **Automatic Task Scanning**: Instantly scans your workspace for `TODO`, `FIXME`, and `BUG` comments.
- **Priority Grouping**: Tasks are automatically grouped by `HIGH`, `MEDIUM`, and `LOW` priorities.
- **Deadlines & Overdue Tracking**: Add dates to your tasks and easily see how many days are left or if they are overdue.
- **The "DONE" List**: Mark tasks as done directly from the sidebar. Completed tasks are moved to a dedicated `DONE` group.
- **One-Click Cleanup**: Individually delete tasks or use the "Delete All Done" button to permanently clear out all completed tasks from your code.
- **Inline Editor Highlighting**: Visually highlights tasks directly in your code with distinct colors based on their priority.
- **Search & Filtering**: Quickly find specific tasks or filter them by priority (e.g., view only `HIGH` or `OVERDUE` tasks).
- **Lightning Fast**: Optimized with concurrent file scanning and debounced real-time updates as you type.

## 💡 How to Use

Visor parses your comments based on a simple syntax:

```typescript
// TODO[PRIORITY][YYYY-MM-DD]: Your task description
```

**Examples:**
- `// TODO[HIGH]: Fix the database connection`
- `// FIXME[MEDIUM][2026-10-15]: Refactor this function`
- `// BUG[LOW]: Typo in the variable name`
- `<!-- TODO: Update the meta tags -->`

## 🖱️ Sidebar Actions

Hover over any task in the **Visor TODOs** sidebar to access quick actions:
- **Mark as Done (`✔`)**: Changes your task's tag to `DONE`, moving it to the DONE group.
- **Delete TODO (`🗑`)**: Completely removes the task's line of code from your file.
- **Delete All Done (`🗑` on DONE folder)**: Scans all completed tasks and removes their lines from your codebase in one go.

## ⚙️ Extension Settings

Visor is highly customizable. You can configure the following settings in your `settings.json`:

* `visor.tags`: An array of keywords to scan for (default: `["TODO", "FIXME", "BUG"]`).
* `visor.ignoreFolders`: Folders to ignore during the scan to keep it fast (default: `["node_modules", ".git", "dist", "build", "out"]`).

## 📋 Requirements

Visor requires Visual Studio Code version `1.107.0` or higher.

## 📝 Release Notes

### 0.0.1
* Initial release of Visor!
* Added priority grouping, deadlines, and inline editor decorations.
* Added Mark as Done, Delete TODO, and Delete All Done actions.

---
**Enjoying Visor?** Feel free to leave a review or contribute to the repository!
