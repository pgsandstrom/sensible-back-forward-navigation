import { getConfig } from '../config'

export const debug = (message: any) => {
  const logDebug = getConfig().logDebug
  if (logDebug) {
    // eslint-disable-next-line
    console.log(message)
  }
}
