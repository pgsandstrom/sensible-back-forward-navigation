import { getConfig } from '../config'

export const debug = (message: any) => {
  const logDebug = getConfig().logDebug
  if (logDebug) {
    console.log(message)
  }
}
