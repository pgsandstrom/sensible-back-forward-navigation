import * as vscode from 'vscode'
import { getConfig } from './config'

interface Movement {
  filepath: string
  line: number
  character: number
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let movementList: Movement[] = []
  let movementPosition = -1

  const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, true, false)
  const onDelete = fileSystemWatcher.onDidDelete((uri: vscode.Uri) => {
    movementList = movementList.filter(movement => {
      if (movement.filepath === uri.path) {
        if (getConfig().logDebug) {
          console.log(`Removing movement due to file being deleted: ${uri.path}`)
        }
        return false
      }
      return true
    })
  })

  const documentChangeListener = vscode.workspace.onDidChangeTextDocument(
    (e: vscode.TextDocumentChangeEvent) => {
      const filepath = e.document.uri.path

      if (e.contentChanges.length === 0) {
        return
      }

      // we only use the last content change, because often that seems to be the relevant one:
      const lastContentChange = e.contentChanges[e.contentChanges.length - 1]
      handleContentChange(lastContentChange, filepath)
    },
  )

  const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(
    (e: vscode.TextEditorSelectionChangeEvent) => {
      // TODO
    },
  )

  const handleContentChange = (change: vscode.TextDocumentContentChangeEvent, filepath: string) => {
    // TODO
  }

  const goBack = () => {}

  const goForward = () => {}

  const goBackCommand = vscode.commands.registerCommand(
    'sensible-back-forward-navigation.goBack',
    goBack,
  )

  const goForwardCommand = vscode.commands.registerCommand(
    'sensible-back-forward-navigation.goForward',
    goForward,
  )

  context.subscriptions.push(
    onDelete,
    documentChangeListener,
    selectionChangeListener,
    goBackCommand,
    goForwardCommand,
  )
}

// this method is called when your extension is deactivated
export function deactivate() {}
