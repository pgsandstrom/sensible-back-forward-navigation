import * as vscode from 'vscode'
import { getConfig, reloadConfig } from './config'
import { debug } from './util/log-util'

interface Movement {
  filepath: string
  line: number
  character: number
  timestamp: number
}

interface Position {
  line: number
  character: number
}

// TODO if we edit one spot, then step line by line to another spot and edit it, then only one movement is saved. This seems wrong.
// We should fix this by maybe always adding something when we edit, if we are not close to last movement.
export function activate(context: vscode.ExtensionContext) {
  const MAX_MOVEMENT_SAVED = 300 // TODO make into config

  let movementList: Movement[] = []
  let stepsBack = 0

  let nextMovementIsCausedByThisExtension = false
  let ignoredMovement: undefined | Movement

  const saveMovement = (movement: Movement) => {
    movementList.push(movement)
    if (movementList.length > MAX_MOVEMENT_SAVED) {
      movementList = movementList.slice(50)
    }
    debug(`saving movement: ${movement.line}, ${movement.character}, ${movement.filepath}`)
    debug(`we now have ${movementList.length} items`)

    stepsBack = 0
  }

  // add initial entry
  if (vscode.window.activeTextEditor) {
    const activePosition = vscode.window.activeTextEditor.selection.active
    const movement: Movement = {
      filepath: vscode.window.activeTextEditor.document.uri.path,
      line: activePosition.line,
      character: activePosition.character,
      timestamp: new Date().getTime(),
    }
    saveMovement(movement)
  }

  const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, true, false)
  const onDelete = fileSystemWatcher.onDidDelete((uri: vscode.Uri) => {
    movementList = movementList.filter((movement) => {
      if (movement.filepath === uri.path) {
        debug(`Removing movement due to file being deleted: ${uri.path}`)
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

  const isMovementsClose = (m1: Movement, m2: Movement, maxLineDiff = 1): boolean => {
    if (m1.filepath !== m2.filepath) {
      return false
    }
    return isPositionClose(m1, m2, maxLineDiff)
  }

  const isPositionClose = (p1: Position, p2: Position, maxLineDiff = 1) => {
    const lineDiff = Math.abs(p1.line - p2.line)
    // const characterDiff = Math.abs(p1.character - p2.character)
    if (lineDiff <= maxLineDiff) {
      return true
    }

    return false
  }

  const getLatestMovement = (): Movement | undefined => {
    const latestMovement = movementList[movementList.length - 1 - stepsBack]
    return latestMovement
  }

  const onSelectionChange = (e: vscode.TextEditorSelectionChangeEvent) => {
    try {
      if (nextMovementIsCausedByThisExtension) {
        nextMovementIsCausedByThisExtension = false
        return
      }

      const selection = e.selections[e.selections.length - 1]
      const movement: Movement = {
        filepath: e.textEditor.document.uri.path,
        line: selection.start.line,
        character: selection.start.character,
        timestamp: new Date().getTime(),
      }

      if (ignoredMovement !== undefined && isMovementsClose(movement, ignoredMovement)) {
        debug('too close to ignored movement')
        ignoredMovement = movement
        return
      }

      const latestMovement = getLatestMovement()
      if (latestMovement !== undefined && isMovementsClose(movement, latestMovement)) {
        debug('too close to latest movement')
        ignoredMovement = movement
        return
      }

      // if we step back in history and then makes a new movement, abondon the old "branch"
      if (stepsBack > 0) {
        debug(`currently ${movementList.length} items`)
        debug(`at ${stepsBack} steps back`)
        debug(`abandoning ${stepsBack} items`)
        movementList = movementList.slice(0, movementList.length - stepsBack)
        debug(`after abandoning we now have ${movementList.length} items`)
      }

      // check for the buggy double entry that happens when you for example 'go to definition' in vscode.
      // If the definition is in another open tab, then vscode first opens the tab and then goes to the definiton.
      // This triggers to movement events. We want to delete the first of those.
      // TODO make the check even more specific. Make sure second to last was in another file?
      if (movementList.length > 0) {
        const lastMovement = movementList[movementList.length - 1]
        const timeDiff = movement.timestamp - lastMovement.timestamp
        if (timeDiff < 30 && lastMovement.filepath === movement.filepath) {
          debug(`removing buggy double entry. Timediff was ${timeDiff}.`)
          movementList.splice(-1)
        }
      }

      // when we save movement, if the latest ignored movement is far away from last save, also save that.
      if (movementList.length > 0 && ignoredMovement) {
        const lastMovement = movementList[movementList.length - 1]
        if (!isMovementsClose(lastMovement, ignoredMovement)) {
          debug('saving ignored movement due to being far away from old and new save point')
          saveMovement(ignoredMovement)
        }
      }

      // save current movement
      saveMovement(movement)
    } catch (e) {
      console.error(`crash in selectionChangeListener`)
      console.error(e)
    }
  }
  const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(onSelectionChange)

  const handleContentChange = (change: vscode.TextDocumentContentChangeEvent, filepath: string) => {
    // TODO fix so we change history when files are edited
  }

  const goBack = () => {
    if (stepsBack >= movementList.length - 1 && movementList.length > 1) {
      debug(`cannot go further back: ${movementList.length}, ${stepsBack}`)
      return
    }

    if (movementList.length === 0) {
      return
    }

    const latestMovement = movementList[movementList.length - 1]

    const activeFilePath = vscode.window.activeTextEditor?.document.uri.path
    const activePosition = vscode.window.activeTextEditor?.selection.active

    if (activePosition === undefined) {
      console.error('cannot go further back')
      return
    }

    // If we have not taken any steps back, but are still not close to the latest saved movement,
    // then we have taken "ignored" steps away from that movement. Thus we begin with just moving to the last saved movement.
    if (
      stepsBack === 0 &&
      (latestMovement.filepath !== activeFilePath ||
        isPositionClose(latestMovement, activePosition) === false)
    ) {
      debug('Weird go back: Just move back to the latest saved movement')
      debug(latestMovement.line)
      debug(latestMovement.character)
      debug(activePosition.line)
      debug(activePosition.character)
    } else {
      // debug('Normal go back')
      stepsBack += 1
    }

    void moveToMovement()
  }

  const goForward = () => {
    if (stepsBack > 0) {
      // debug('going forward')
      stepsBack -= 1
      void moveToMovement()
    }
  }

  const moveToMovement = async () => {
    const movement = getLatestMovement()
    if (movement === undefined) {
      return
    }

    debug(`move to ${stepsBack} steps back`)

    nextMovementIsCausedByThisExtension = true

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

    // TODO is our whole movementPosition super confusing?
    // movementPosition += 1
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
    if (e.affectsConfiguration('sensible-back-forward-navigation')) {
      reloadConfig()
    }
  })

  context.subscriptions.push(
    onDelete,
    documentChangeListener,
    selectionChangeListener,
    goBackCommand,
    goForwardCommand,
    onConfigChange,
  )
}

export function deactivate() {
  //
}
