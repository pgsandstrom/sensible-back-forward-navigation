import * as vscode from 'vscode'

interface Config {
  logDebug: boolean
}

let currentConfig: Config | undefined

export const getConfig = (): Config => {
  if (currentConfig === undefined) {
    reloadConfig()
  }
  return currentConfig as Config
}

export const reloadConfig = () => {
  const config = vscode.workspace.getConfiguration('sensible-back-forward-navigation')
  const newConfig: Config = {
    logDebug: config.get<boolean>('logDebug') === true,
  }

  currentConfig = newConfig
}
