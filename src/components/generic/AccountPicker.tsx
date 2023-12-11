import { ContactDoc, AccountDoc, useAccount, useSelf } from "../../account";
import { DocumentId, stringifyAutomergeUrl } from "@automerge/automerge-repo";
import { isValidDocumentId } from "@automerge/automerge-repo/dist/AutomergeUrl"; // todo: get this properly exported from automerge-repo
import { ChangeEvent, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useDocument } from "@automerge/automerge-repo-react-hooks";

import { Copy, Eye, EyeOff } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContactAvatar } from "./ContactAvatar";

enum AccountPickerTab {
  LogIn = "logIn",
  SignUp = "signUp",
}

export const AccountPicker = () => {
  const account = useAccount();

  const self = useSelf();
  const [name, setName] = useState<string>("");
  const [avatar, setAvatar] = useState<File>();
  const [accountDocId, setAccountDocId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<AccountPickerTab>(
    AccountPickerTab.SignUp
  );
  const [showAccountUrl, setShowAccountUrl] = useState(false);
  const [isCopyTooltipOpen, setIsCopyTooltipOpen] = useState(false);
  const [accountToLogin] = useDocument<AccountDoc>(
    accountDocId &&
      isValidDocumentId(accountDocId) &&
      stringifyAutomergeUrl(accountDocId)
  );
  const [contactToLogin] = useDocument<ContactDoc>(accountToLogin?.contactUrl);

  // initialize form values if already logged in
  useEffect(() => {
    if (self && self.type === "registered" && name === "") {
      setName(self.name);
    }
  }, [self]);

  const onSubmit = () => {
    switch (activeTab) {
      case AccountPickerTab.LogIn:
        account.logIn(stringifyAutomergeUrl(accountDocId as DocumentId));
        break;

      case AccountPickerTab.SignUp:
        account.signUp({ name, avatar });
        break;
    }
  };

  const onLogout = () => {
    account.logOut();
  };

  const onFilesChanged = (e: ChangeEvent<HTMLInputElement>) => {
    setAvatar(!e.target.files ? undefined : e.target.files[0]);
  };

  const onToggleShowAccountUrl = () => {
    setShowAccountUrl((showAccountUrl) => !showAccountUrl);
  };

  const onCopy = () => {
    navigator.clipboard.writeText(account.handle.documentId);

    setIsCopyTooltipOpen(true);

    setTimeout(() => {
      setIsCopyTooltipOpen(false);
    }, 1000);
  };

  const isSubmittable =
    (activeTab === AccountPickerTab.SignUp && name) ||
    (activeTab === AccountPickerTab.LogIn &&
      accountDocId &&
      accountToLogin?.contactUrl &&
      contactToLogin?.type === "registered");

  const isLoggedIn = self?.type === "registered";

  return (
    <Dialog>
      <DialogTrigger>
        <ContactAvatar url={account?.contactHandle.url} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="items-center">
          {isLoggedIn ? (
            <ContactAvatar
              size="lg"
              url={account?.contactHandle.url}
              name={name}
              avatar={avatar}
            ></ContactAvatar>
          ) : activeTab === "signUp" ? (
            <ContactAvatar name={name} avatar={avatar} size={"lg"} />
          ) : (
            <ContactAvatar
              url={accountToLogin?.contactUrl}
              size="lg"
            ></ContactAvatar>
          )}
        </DialogHeader>

        {!isLoggedIn && (
          <Tabs
            defaultValue={AccountPickerTab.SignUp}
            className="w-full"
            onValueChange={(tab) => setActiveTab(tab as AccountPickerTab)}
            value={activeTab}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value={AccountPickerTab.SignUp}>Sign up</TabsTrigger>
              <TabsTrigger value={AccountPickerTab.LogIn}>Log in</TabsTrigger>
            </TabsList>
            <TabsContent value={AccountPickerTab.SignUp}>
              <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(evt) => setName(evt.target.value)}
                />
              </div>

              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="picture">Avatar</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={onFilesChanged}
                />
              </div>
            </TabsContent>
            <TabsContent value={AccountPickerTab.LogIn}>
              <form className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <Label htmlFor="accountUrl">Account token</Label>

                <div className="flex gap-1.5">
                  <Input
                    className="cursor-"
                    id="accountUrl"
                    value={accountDocId}
                    onChange={(evt) => {
                      setAccountDocId(evt.target.value);
                    }}
                    type={showAccountUrl ? "text" : "password"}
                    autoComplete="current-password"
                  />
                  <Button variant="ghost" onClick={onToggleShowAccountUrl}>
                    {showAccountUrl ? <Eye /> : <EyeOff />}
                  </Button>
                </div>

                <p className="text-gray-500 text-justify pb-2 text-sm">
                  To login, paste your account token.
                </p>
                <p className="text-gray-500 text-justify pb-2 text-sm mb-2">
                  You can find your token by accessing the account dialog on any
                  device where you are currently logged in.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        )}

        {isLoggedIn && (
          <>
            <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(evt) => setName(evt.target.value)}
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="picture">Avatar</Label>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={onFilesChanged}
              />
            </div>

            <form className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="picture">Account token</Label>

              <div className="flex gap-1.5">
                <Input
                  onFocus={(e) => e.target.select()}
                  value={account.handle.documentId}
                  id="accountUrl"
                  type={showAccountUrl ? "text" : "password"}
                  accept="image/*"
                  onChange={onFilesChanged}
                  autoComplete="off"
                />

                <Button variant="ghost" onClick={onToggleShowAccountUrl}>
                  {showAccountUrl ? <Eye /> : <EyeOff />}
                </Button>

                <TooltipProvider>
                  <Tooltip open={isCopyTooltipOpen}>
                    <TooltipTrigger
                      onClick={onCopy}
                      onBlur={() => setIsCopyTooltipOpen(false)}
                    >
                      <Copy />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copied</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <p className="text-gray-500 text-justify pt-2 text-sm">
                To log in on another device, copy your account token and paste
                it into the login screen on the other device.
              </p>
              <p className="text-gray-500 text-justify pt-2 text-sm">
                ⚠️ WARNING: this app has limited security, don't use it for
                private docs.
              </p>
            </form>
          </>
        )}
        <DialogFooter className="gap-1.5">
          {isLoggedIn && (
            <DialogTrigger asChild>
              <Button onClick={onLogout} variant="secondary">
                Sign out
              </Button>
            </DialogTrigger>
          )}
          <DialogTrigger asChild>
            <Button type="submit" onClick={onSubmit} disabled={!isSubmittable}>
              {isLoggedIn
                ? "Save"
                : activeTab === "signUp"
                ? "Sign up"
                : `Log in${
                    contactToLogin && contactToLogin.type === "registered"
                      ? ` as ${contactToLogin.name}`
                      : ""
                  }`}
            </Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
