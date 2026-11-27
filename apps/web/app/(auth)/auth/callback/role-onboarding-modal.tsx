'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@iconicedu/ui-web';

type RoleSelection = 'parent' | 'educator' | 'student';

export interface RoleOnboardingSubmitInput {
  role: RoleSelection;
  inviteCode?: string;
  referrerName?: string;
  skipReferral?: boolean;
}

type RoleOnboardingModalProps = {
  open: boolean;
  referralsEnabled?: boolean;
  linkedReferrerName?: string;
  onSubmit: (
    input: RoleOnboardingSubmitInput,
  ) => Promise<{ success: boolean; message?: string }>;
};

const ROLE_OPTIONS: Array<{
  value: RoleSelection;
  title: string;
  description: string;
}> = [
  {
    value: 'parent',
    title: 'Parent',
    description: 'Set up your family class and continue immediately.',
  },
  {
    value: 'student',
    title: 'Student',
    description: 'Join your class with your invite or join code.',
  },
  {
    value: 'educator',
    title: 'Tutor',
    description: 'Request tutor access. We review each request before activation.',
  },
];

export function RoleOnboardingModal({
  open,
  onSubmit,
  referralsEnabled = false,
  linkedReferrerName = '',
}: RoleOnboardingModalProps) {
  const [selectedRole, setSelectedRole] = React.useState<RoleSelection | null>(null);
  const [inviteCode, setInviteCode] = React.useState('');
  const [referrerName, setReferrerName] = React.useState('');
  const [skipReferral, setSkipReferral] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleContinue = async () => {
    if (!selectedRole) {
      setErrorMessage('Select a role to continue.');
      return;
    }

    if (selectedRole === 'student' && !inviteCode.trim()) {
      setErrorMessage('Enter your invite code to continue as a student.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await onSubmit({
        role: selectedRole,
        inviteCode: selectedRole === 'student' ? inviteCode : undefined,
        ...(referralsEnabled && selectedRole === 'parent'
          ? {
              ...(skipReferral
                ? { skipReferral: true }
                : !linkedReferrerName
                  ? { referrerName: referrerName.trim() }
                  : {}),
            }
          : {}),
      });
      if (!result.success) {
        setErrorMessage(result.message ?? 'Unable to complete onboarding.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-[48rem]">
        <DialogHeader>
          <DialogTitle>Choose your role to continue</DialogTitle>
          <DialogDescription>
            Select how you use ICONIC Academy. We use this to personalize access and keep
            student spaces secure.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3" role="radiogroup" aria-label="Role selection">
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selectedRole === option.value}
              className={`rounded-3xl border px-4 py-3 text-left transition ${
                selectedRole === option.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
              }`}
              onClick={() => setSelectedRole(option.value)}
            >
              <p className="font-semibold">{option.title}</p>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </button>
          ))}
        </div>

        {selectedRole === 'student' ? (
          <div className="grid gap-2">
            <Label htmlFor="inviteCode">Invite code</Label>
            <Input
              id="inviteCode"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Enter your student invite code"
            />
            <p className="text-xs text-muted-foreground">
              Ask your educator or parent for a valid code to join your class.
            </p>
          </div>
        ) : null}

        {selectedRole === 'parent' && referralsEnabled && (
          <div className="grid gap-2">
            <Label htmlFor="referrerName">Who referred you? (optional)</Label>
            <Input
              id="referrerName"
              value={skipReferral ? '' : linkedReferrerName || referrerName}
              readOnly={!!linkedReferrerName}
              disabled={isSubmitting}
              maxLength={100}
              onChange={(event) => {
                setReferrerName(event.target.value);
              }}
              placeholder={
                skipReferral ? 'No referral attached' : 'Referring parent’s name'
              }
              autoComplete="off"
            />
            {linkedReferrerName && !skipReferral && (
              <button
                type="button"
                className="w-fit text-sm underline"
                disabled={isSubmitting}
                onClick={() => setSkipReferral(true)}
              >
                Remove referral
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              {linkedReferrerName && !skipReferral
                ? 'Your invitation has attached this parent automatically.'
                : skipReferral
                  ? 'Referral removed. You can continue normally.'
                  : 'If a parent recommended ICONIC Academy, enter their name so our team can confirm their $20 discount.'}
            </p>
          </div>
        )}

        {selectedRole === 'educator' ? (
          <p className="rounded-2xl border border-amber-300/50 bg-amber-100/40 px-3 py-2 text-xs text-amber-900 dark:border-amber-600/40 dark:bg-amber-900/30 dark:text-amber-100">
            Tutor access is reviewed. You can continue now, and we&apos;ll notify you when
            approval is complete.
          </p>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" onClick={handleContinue} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
