import { act, renderHook } from '@testing-library/react-native';
import { useSignupName } from './use-signup-name';

describe('signup display name', () => {
  it('suggests the first name and last initial and follows name edits', () => {
    const { result } = renderHook(() => useSignupName());
    act(() => {
      result.current.setFirstName(' Jane ');
      result.current.setLastName(' Smith ');
    });
    expect(result.current.displayName).toBe('Jane S');
    act(() => result.current.setLastName('Brown'));
    expect(result.current.displayName).toBe('Jane B');
  });

  it('preserves a custom value and an explicitly cleared value', () => {
    const { result } = renderHook(() => useSignupName());
    act(() => result.current.setDisplayName('Coach J'));
    act(() => result.current.setFirstName('Jane'));
    expect(result.current.displayName).toBe('Coach J');
    act(() => result.current.setDisplayName(''));
    act(() => result.current.setLastName('Smith'));
    expect(result.current.displayName).toBe('');
  });
});
