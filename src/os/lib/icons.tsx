// todo: we could reduce the icon set or load them dynamically
import { FileQuestionIcon, icons } from "lucide-react";

export type IconType = keyof typeof icons;

type IconViewProps = {
  type: IconType;
  size?: number;
  className?: string;
};

export const Icon = ({ type, size, className }: IconViewProps) => {
  const IconComponent = icons[type];

  if (!IconComponent) {
    return <FileQuestionIcon size={size} className={className} />;
  }

  return <IconComponent size={size} className={className} />;
};
