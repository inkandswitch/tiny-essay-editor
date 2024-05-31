import confetti from "canvas-confetti";
import { EditorProps } from "@/os/tools";
import { Button } from "@/components/ui/button";
import { useDocument } from "@automerge/automerge-repo-react-hooks";

export const Confetti = ({ docUrl }: EditorProps<never, never>) => {
  const [doc] = useDocument(docUrl);

  const onClick = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="w-full h-full overflow-hidden flex items-center justify-center">
      <div>
        <Button onClick={onClick}>Confetti</Button>
      </div>
      <pre>{JSON.stringify(doc, null, 2)}</pre>
    </div>
  );
};
