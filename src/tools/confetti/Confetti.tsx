import confetti from "canvas-confetti";
import { EditorProps } from "@/os/tools";
import { Button } from "@/components/ui/button";

export const Confetti = ({}: EditorProps<never, never>) => {
  const onClick = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="w-full h-full overflow-hidden flex items-center justify-center">
      <Button onClick={onClick}>Confetti</Button>
    </div>
  );
};
