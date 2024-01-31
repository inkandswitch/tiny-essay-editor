import {
  ContactDoc,
  AccountDoc,
  useCurrentAccount,
  useSelf,
  automergeUrlToAccountToken,
  accountTokenToAutomergeUrl,
} from "../account";
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

import Circle from '@uiw/react-color-circle';
export const USER_COLORS = {
  // RUST: '#D96767',
  // ENGINEER: '#FFE283',
  // KEYLIME: '#A1E991',
  // PINE: '#63D2A5',
  // SOFT: '#64BCDF',
  // BIGBLUE: '#3A66A3',
  // ROYAL: '#A485E2',
  // KAWAII: '#ED77AB',
  // BLACK: '#2b2b2b',
  RED: '#F87060',
  VORANGE: '#FFC919',
  DARKGRE: '#6CCB44',
  PINETO: '#00CA7B',
  VBLAU: '#3395E8',
  CHILBLAU: '#004098',
  OPTIROYA: '#4700D8',
  MAGEGENTA: '#E80FA7',
  GRAU: '#626262',
}

// 1MB in bytes
const MAX_AVATAR_SIZE = 1024 * 1024;

enum AccountPickerTab {
  LogIn = "logIn",
  SignUp = "signUp",
}

type AccountTokenToLoginStatus = null | "valid" | "malformed" | "not-found";

export const AccountPicker = ({
  showName,
  size = "default",
}: {
  showName?: boolean;
  size?: "default" | "sm" | "lg";
}) => {
  const currentAccount = useCurrentAccount();

  const self = useSelf();
  const [name, setName] = useState<string>("");
  const [color, setColor] = useState<string>("#F44E3B");
  
  const [avatar, setAvatar] = useState<File>();
  const [activeTab, setActiveTab] = useState<AccountPickerTab>(
    AccountPickerTab.SignUp
  );
  const [showAccountUrl, setShowAccountUrl] = useState(false);
  const [isCopyTooltipOpen, setIsCopyTooltipOpen] = useState(false);

  const [accountTokenToLogin, setAccountTokenToLogin] = useState<string>("");
  const accountAutomergeUrlToLogin = accountTokenToLogin
    ? accountTokenToAutomergeUrl(accountTokenToLogin)
    : undefined;

  const [accountToLogin] = useDocument<AccountDoc>(accountAutomergeUrlToLogin);
  const [contactToLogin] = useDocument<ContactDoc>(accountToLogin?.contactUrl);

  const accountTokenToLoginStatus: AccountTokenToLoginStatus = (() => {
    if (!accountTokenToLogin || accountTokenToLogin === "") return null;
    if (!accountAutomergeUrlToLogin) return "malformed";
    if (!accountToLogin) return "not-found";
    if (!contactToLogin) return "not-found";
    return "valid";
  })();

  const currentAccountToken = currentAccount
    ? automergeUrlToAccountToken(currentAccount.handle.url, name)
    : null;

  // initialize form values if already logged in
  useEffect(() => {
    if (self && self.type === "registered" && name === "") {
      setName(self.name);
    }
  }, [self]);

  const onSubmit = () => {
    switch (activeTab) {
      case AccountPickerTab.LogIn:
        currentAccount.logIn(accountAutomergeUrlToLogin);
        break;

      case AccountPickerTab.SignUp:
        currentAccount.signUp({ name, avatar, color });
        break;
    }
  };

  const onLogout = () => {
    currentAccount.logOut();
  };

  const onFilesChanged = (e: ChangeEvent<HTMLInputElement>) => {
    const avatarFile = !e.target.files ? undefined : e.target.files[0];
    if (avatarFile.size > MAX_AVATAR_SIZE) {
      alert("Avatar is too large. Please choose a file under 1MB.");
      e.target.value = "";
      return;
    }
    setAvatar(avatarFile);
  };

  const onToggleShowAccountUrl = () => {
    setShowAccountUrl((showAccountUrl) => !showAccountUrl);
  };

  const onCopy = () => {
    navigator.clipboard.writeText(currentAccountToken);

    setIsCopyTooltipOpen(true);

    setTimeout(() => {
      setIsCopyTooltipOpen(false);
    }, 1000);
  };

  const isSubmittable =
    (activeTab === AccountPickerTab.SignUp && name) ||
    (activeTab === AccountPickerTab.LogIn &&
      accountTokenToLogin &&
      accountToLogin?.contactUrl &&
      contactToLogin?.type === "registered");

  const isLoggedIn = self?.type === "registered";

  return (
    <Dialog>
      <DialogTrigger>
        <div className="flex flex-row  text-sm text-gray-600 hover:text-gray-800 ">
          <ContactAvatar url={currentAccount?.contactHandle.url} size={size} />
          {showName && isLoggedIn && <div className="ml-2 py-2">{name}</div>}
          {showName && !isLoggedIn && <div className="ml-2 py-2">Sign in</div>}
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="items-center">
          {isLoggedIn ? (
            <ContactAvatar
              size="default"
              url={currentAccount?.contactHandle.url}
              name={name}
              avatar={avatar}
            />
          ) : activeTab === "signUp" ? (
            <ContactAvatar name={name} avatar={avatar} size={"lg"} />
          ) : (
            <ContactAvatar url={accountToLogin?.contactUrl} size="lg" />
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

              <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <Label htmlFor="name">Presence Color</Label>
                <Circle
                  colors={Object.values(USER_COLORS)}
                  color={color}
                  onChange={(color) => {
                    setColor(color.hex);
                  }}
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
                    className={`${
                      accountTokenToLoginStatus === "valid"
                        ? "bg-green-100"
                        : ""
                    }`}
                    id="accountUrl"
                    value={accountTokenToLogin}
                    onChange={(evt) => {
                      setAccountTokenToLogin(evt.target.value);
                    }}
                    type={showAccountUrl ? "text" : "password"}
                    autoComplete="current-password"
                  />
                  <Button variant="ghost" onClick={onToggleShowAccountUrl}>
                    {showAccountUrl ? <Eye /> : <EyeOff />}
                  </Button>
                </div>

                <div className="h-8 text-sm text-red-500">
                  {accountTokenToLoginStatus === "malformed" && (
                    <div>
                      Not a valid account token, try copy-pasting again.
                    </div>
                  )}
                  {accountTokenToLoginStatus === "not-found" && (
                    <div>Account not found</div>
                  )}
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
            
            <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <Label htmlFor="name">Presence Color</Label>
                <Circle
                  colors={Object.values(USER_COLORS)}
                  color={color}
                  onChange={(color) => {
                    setColor(color.hex);
                  }}
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
                  value={currentAccountToken}
                  id="accountUrl"
                  type={showAccountUrl ? "text" : "password"}
                  accept="image/*"
                  onChange={onFilesChanged}
                  autoComplete="off"
                />

                <Button
                  variant="ghost"
                  onClick={onToggleShowAccountUrl}
                  type="button"
                >
                  {showAccountUrl ? <Eye /> : <EyeOff />}
                </Button>

                <TooltipProvider>
                  <Tooltip open={isCopyTooltipOpen}>
                    <TooltipTrigger
                      type="button"
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
