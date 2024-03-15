import React from "react"

type Props = {
  onImageChosen: (url: string) => void
}

export default function ImageForm({ onImageChosen }: Props) {
  const [imageUrl, setImageUrl] = React.useState("")

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onImageChosen(imageUrl)
  }
  return (
    <form>
      <input onChange={e => setImageUrl(e.target.value)} value={imageUrl} />
      <button onClick={onFormSubmit}>Insert</button>
    </form>
  )
}
