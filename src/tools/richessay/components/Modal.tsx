import React, { useEffect, useRef, useState } from "react"

type Props = {
  children: React.ReactNode
  onClose: () => void
  isOpen: boolean
}

export default function Modal({ children, isOpen, onClose }: Props) {
  const modalRef = useRef<HTMLDialogElement | null>(null)
  const [isModalOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(isOpen)
  }, [isOpen])

  useEffect(() => {
    if (!modalRef.current) {
      return
    }
    if (isModalOpen) {
      modalRef.current.showModal()
    } else {
      modalRef.current.close()
      onClose()
    }
  }, [isModalOpen])

  return <dialog ref={modalRef}>{children}</dialog>
}
