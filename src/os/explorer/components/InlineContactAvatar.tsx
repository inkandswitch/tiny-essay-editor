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
import { useBlobUrl } from "@/os/explorer/utils";
import { User as UserIcon } from "lucide-react";

interface ContactAvatarProps extends VariantProps<typeof avatarVariants> {
  url?: AutomergeUrl;
  showName?: boolean;
  showImage?: boolean;
  name?: string;
  avatar?: File;
  size: "default" | "sm" | "lg";
}

export const InlineContactAvatar = ({
  url,
  showImage = true,
  showName = true,
}: ContactAvatarProps) => {
  const [maybeAnonymousContact] = useDocument<ContactDoc>(url);
  const [registeredContact] = useDocument<RegisteredContactDoc>(undefined);

  const contact: RegisteredContactDoc =
    maybeAnonymousContact?.type === "registered"
      ? maybeAnonymousContact
      : registeredContact;

  const avatarBlobUrl = useBlobUrl(contact?.avatarUrl);

  const avatarUrl =
    url && contact?.avatarUrl && showImage ? avatarBlobUrl : undefined;
  const name = contact?.name;

  return (
    <div className="inline">
      <Avatar size={"sm"} className="inline border-transparent">
        {showImage && (
          <AvatarImage
            src={avatarUrl}
            alt={name}
            className="inline h-4 w-4 align-top rounded-full border-[0.5px] border-neutral-800"
          />
        )}
        <AvatarFallback className="inline h-4 w-4 align-top mt-[1px] mr-1 rounded-full">
          <UserIcon className="inline h-4 w-4 align-top rounded-full" />
        </AvatarFallback>
      </Avatar>

      {showName && <span>{name ?? "Anonymous"}</span>}
    </div>
  );
};
