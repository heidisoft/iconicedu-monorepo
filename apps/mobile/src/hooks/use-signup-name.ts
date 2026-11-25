import { useState } from 'react';

export function useSignupName() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customDisplayName, setDisplayName] = useState<string | null>(null);
  const displayName =
    customDisplayName ??
    [firstName.trim(), Array.from(lastName.trim())[0]].filter(Boolean).join(' ');

  return { firstName, setFirstName, lastName, setLastName, displayName, setDisplayName };
}
