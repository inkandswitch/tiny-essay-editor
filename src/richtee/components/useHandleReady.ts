import { type DocHandle } from "@automerge/automerge-repo"
import { useEffect, useState } from "react"

export function useHandleReady(handle: DocHandle<unknown>) {
  const [isReady, setIsReady] = useState(handle.isReady())
  useEffect(() => {
    if (!isReady) {
      handle.whenReady().then(() => {
        setIsReady(true)
      })
    }
  }, [handle])
  return isReady
}
