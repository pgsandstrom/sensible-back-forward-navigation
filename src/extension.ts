import * as vscode from 'vscode'
import { getConfig, reloadConfig } from './config'

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

  let nextMovementIsCausedByThisExtension = false
  let ignoredMovement: undefined | Movement

  const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, true, false)
  const onDelete = fileSystemWatcher.onDidDelete((uri: vscode.Uri) => {
    movementList = movementList.filter((movement) => {
      if (movement.filepath === uri.path) {
        if (getConfig().logDebug) {
          console.log(`Removing movement due to file being deleted: ${uri.path}`)
        }
        return false
      }
      return true
    })
  })

  // const documentChangeListener = vscode.workspace.onDidChangeTextDocument(
  //   (e: vscode.TextDocumentChangeEvent) => {
  //     const filepath = e.document.uri.path

  //     if (e.contentChanges.length === 0) {
  //       return
  //     }

  //     // we only use the last content change, because often that seems to be the relevant one:
  //     const lastContentChange = e.contentChanges[e.contentChanges.length - 1]
  //     handleContentChange(lastContentChange, filepath)
  //   },
  // )

  const isMovementsClose = (m1: Movement, m2: Movement): boolean => {
    if (m1.filepath !== m2.filepath) {
      return false
    }

    const lineDiff = Math.abs(m1.line - m2.line)
    const characterDiff = Math.abs(m1.character - m2.character)
    if (lineDiff + characterDiff < 2) {
      return true
    }

    return false
  }

  const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(
    (e: vscode.TextEditorSelectionChangeEvent) => {
      if (nextMovementIsCausedByThisExtension) {
        nextMovementIsCausedByThisExtension = false
        return
      }

      const selection = e.selections[e.selections.length - 1]
      const movement: Movement = {
        filepath: e.textEditor.document.uri.path,
        line: selection.start.line,
        character: selection.start.character,
      }

      if (ignoredMovement !== undefined && isMovementsClose(movement, ignoredMovement)) {
        console.log('too close to ignored movement')
        ignoredMovement = movement
        return
      }

      if (movementList.length > 0) {
        const latestMovement = movementList[movementPosition]
        if (isMovementsClose(movement, latestMovement)) {
          ignoredMovement = movement
          return
        }
      }

      // if we step back in history and then makes a new movement, abondon the old "branch"
      if (movementList.length > movementPosition + 1) {
        movementList = movementList.slice(0, movementPosition + 1)
        console.log(`abandoning ${movementList.length - (movementPosition + 1)} items`)
      }

      movementList.push(movement)
      movementPosition += 1
      console.log(`saving movement: ${selection.start.line}, ${selection.start.character}`)
      console.log(`length: ${movementList.length}`)
    },
  )

  // const handleContentChange = (change: vscode.TextDocumentContentChangeEvent, filepath: string) => {
  //   // TODO
  // }

  const goBack = () => {
    if (movementPosition > 0) {
      console.log('going back')
      movementPosition -= 1
    }
    moveToMovement()
  }

  const goForward = () => {
    if (movementPosition !== -1 && movementPosition < movementList.length - 1) {
      console.log('going forward')
      movementPosition += 1
    }
    moveToMovement()
  }

  const moveToMovement = async () => {
    console.log(`moveToMovement:${movementPosition}, ${movementList.length}`)
    if (movementPosition === -1) {
      return
    }

    nextMovementIsCausedByThisExtension = true

    const movement = movementList[movementPosition]
    const activeFilepath = vscode.window.activeTextEditor?.document.uri.path

    let activeEditor: vscode.TextEditor
    if (activeFilepath !== movement.filepath) {
      const textdocument = await vscode.workspace.openTextDocument(movement.filepath)
      activeEditor = await vscode.window.showTextDocument(textdocument)
    } else {
      activeEditor = vscode.window.activeTextEditor!
    }

    activeEditor.selection = new vscode.Selection(
      movement.line,
      movement.character,
      movement.line,
      movement.character,
    )
    const rangeToReveal = new vscode.Range(
      movement.line,
      movement.character,
      movement.line,
      movement.character,
    )
    activeEditor.revealRange(
      rangeToReveal,
      getConfig().centerOnMovement
        ? vscode.TextEditorRevealType.InCenterIfOutsideViewport
        : vscode.TextEditorRevealType.Default,
    )
  }

  const goBackCommand = vscode.commands.registerCommand(
    'sensible-back-forward-navigation.goBack',
    goBack,
  )

  const goForwardCommand = vscode.commands.registerCommand(
    'sensible-back-forward-navigation.goForward',
    goForward,
  )

  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('navigateEditHistory')) {
      reloadConfig()
    }
  })

  context.subscriptions.push(
    onDelete,
    // documentChangeListener,
    selectionChangeListener,
    goBackCommand,
    goForwardCommand,
    onConfigChange,
  )
}

export function deactivate() {
  //
}
