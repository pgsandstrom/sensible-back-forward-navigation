import { getConfig } from '../config'

export const debug = (message: string) => {
  const logDebug = getConfig().logDebug
  if (logDebug) {
    console.log(message)
  }
}
