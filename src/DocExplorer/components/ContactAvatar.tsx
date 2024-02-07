import { ContactDoc, RegisteredContactDoc } from "../account";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { VariantProps } from "class-variance-authority";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  avatarVariants,
} from "@/components/ui/avatar";
import { useBlobUrl } from "@/DocExplorer/utils";
import { useMemo } from "react";
import { User as UserIcon } from "lucide-react";

interface ContactAvatarProps extends VariantProps<typeof avatarVariants> {
  url?: AutomergeUrl;
  showName?: boolean;
  showImage?: boolean;
  name?: string;
  avatar?: File;
  size: "default" | "sm" | "lg";
}

const initials = (name: string) => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("");
};

export const ContactAvatar = ({
  name: nameOverride,
  avatar: avatarOverride,
  url,
  showName = false,
  showImage = true,
  size,
}: ContactAvatarProps) => {
  const [maybeAnonymousContact] = useDocument<ContactDoc>(url);
  const [registeredContact] = useDocument<RegisteredContactDoc>(undefined);

  const contact: RegisteredContactDoc =
    maybeAnonymousContact?.type === "registered"
      ? maybeAnonymousContact
      : registeredContact;

  const avatarBlobUrl = useBlobUrl(contact?.avatarUrl);
  const avatarOverrideUrl = useMemo(
    () => avatarOverride && URL.createObjectURL(avatarOverride),
    [avatarOverride]
  );

  const avatarUrl = avatarOverrideUrl
    ? avatarOverrideUrl
    : url && contact?.avatarUrl
    ? avatarBlobUrl
    : undefined;
  const name = nameOverride ?? contact?.name;

  return (
    <div className="flex items-center gap-1.5">
      {showImage && (
        <Avatar size={size}>
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback>
            {name ? initials(name) : <UserIcon />}
          </AvatarFallback>
        </Avatar>
      )}

      {showName && <span>{name ?? "Anonymous"}</span>}
    </div>
  );
};
