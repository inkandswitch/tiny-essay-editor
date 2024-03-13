import React from "react"

type Props = {
  onUrlChosen: (url: string) => void
}

export default function ImageForm({ onUrlChosen }: Props) {
  const [linkUrl, setLinkUrl] = React.useState("")

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUrlChosen(linkUrl)
  }
  return (
    <form>
      <input onChange={e => setLinkUrl(e.target.value)} value={linkUrl} />
      <button onClick={onFormSubmit}>Insert</button>
    </form>
  )
}
