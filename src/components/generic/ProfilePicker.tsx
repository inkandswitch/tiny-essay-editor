import { ContactDoc, ProfileDoc, useProfile, useSelf } from "../../profile";
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

enum ProfilePickerTab {
  LogIn = "logIn",
  SignUp = "signUp",
}

export const ProfilePicker = () => {
  const profile = useProfile();

  const self = useSelf();
  const [name, setName] = useState<string>("");
  const [avatar, setAvatar] = useState<File>();
  const [profileDocId, setProfileDocId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ProfilePickerTab>(
    ProfilePickerTab.SignUp
  );
  const [showProfileUrl, setShowProfileUrl] = useState(false);
  const [isCopyTooltipOpen, setIsCopyTooltipOpen] = useState(false);
  const [profileToLogin] = useDocument<ProfileDoc>(
    profileDocId &&
      isValidDocumentId(profileDocId) &&
      stringifyAutomergeUrl(profileDocId)
  );
  const [contactToLogin] = useDocument<ContactDoc>(profileToLogin?.contactUrl);

  // initialize form values if already logged in
  useEffect(() => {
    if (self && self.type === "registered" && name === "") {
      setName(self.name);
    }
  }, [self]);

  const onSubmit = () => {
    switch (activeTab) {
      case ProfilePickerTab.LogIn:
        profile.logIn(stringifyAutomergeUrl(profileDocId as DocumentId));
        break;

      case ProfilePickerTab.SignUp:
        profile.signUp({ name, avatar });
        break;
    }
  };

  const onLogout = () => {
    profile.logOut();
  };

  const onFilesChanged = (e: ChangeEvent<HTMLInputElement>) => {
    setAvatar(!e.target.files ? undefined : e.target.files[0]);
  };

  const onToggleShowProfileUrl = () => {
    setShowProfileUrl((showProfileUrl) => !showProfileUrl);
  };

  const onCopy = () => {
    navigator.clipboard.writeText(profile.handle.documentId);

    setIsCopyTooltipOpen(true);

    setTimeout(() => {
      setIsCopyTooltipOpen(false);
    }, 1000);
  };

  const isSubmittable =
    (activeTab === ProfilePickerTab.SignUp && name) ||
    (activeTab === ProfilePickerTab.LogIn &&
      profileDocId &&
      profileToLogin?.contactUrl &&
      contactToLogin?.type === "registered");

  const isLoggedIn = self?.type === "registered";

  return (
    <Dialog>
      <DialogTrigger>
        <ContactAvatar url={profile?.contactHandle.url} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="items-center">
          {isLoggedIn ? (
            <ContactAvatar
              size="lg"
              url={profile?.contactHandle.url}
              name={name}
              avatar={avatar}
            ></ContactAvatar>
          ) : activeTab === "signUp" ? (
            <ContactAvatar name={name} avatar={avatar} size={"lg"} />
          ) : (
            <ContactAvatar
              url={profileToLogin?.contactUrl}
              size="lg"
            ></ContactAvatar>
          )}
        </DialogHeader>

        {!isLoggedIn && (
          <Tabs
            defaultValue={ProfilePickerTab.SignUp}
            className="w-full"
            onValueChange={(tab) => setActiveTab(tab as ProfilePickerTab)}
            value={activeTab}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value={ProfilePickerTab.SignUp}>Sign up</TabsTrigger>
              <TabsTrigger value={ProfilePickerTab.LogIn}>Log in</TabsTrigger>
            </TabsList>
            <TabsContent value={ProfilePickerTab.SignUp}>
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
            <TabsContent value={ProfilePickerTab.LogIn}>
              <form className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <p className="text-gray-500 text-justify pb-2 text-sm">
                  To login, paste your secret login token.
                </p>
                <p className="text-gray-500 text-justify pb-2 text-sm mb-2">
                  You can find your token by accessing the profile dialog on any
                  device where you are currently logged in.
                </p>

                <Label htmlFor="profileUrl">Secret login token</Label>

                <div className="flex gap-1.5">
                  <Input
                    className="cursor-"
                    id="profileUrl"
                    value={profileDocId}
                    onChange={(evt) => {
                      setProfileDocId(evt.target.value);
                    }}
                    type={showProfileUrl ? "text" : "password"}
                    autoComplete="current-password"
                  />
                  <Button variant="ghost" onClick={onToggleShowProfileUrl}>
                    {showProfileUrl ? <Eye /> : <EyeOff />}
                  </Button>
                </div>
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
              <Label htmlFor="picture">Secret login token</Label>

              <div className="flex gap-1.5">
                <Input
                  onFocus={(e) => e.target.select()}
                  value={profile.handle.documentId}
                  id="profileUrl"
                  type={showProfileUrl ? "text" : "password"}
                  accept="image/*"
                  onChange={onFilesChanged}
                  autoComplete="off"
                />

                <Button variant="ghost" onClick={onToggleShowProfileUrl}>
                  {showProfileUrl ? <Eye /> : <EyeOff />}
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
                To log in on another device, copy your secret login token and
                paste it into the login screen on the other device.
              </p>
              <p className="text-gray-500 text-justify pt-2 text-sm">
                ⚠️ Keep your token secret from others!
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
