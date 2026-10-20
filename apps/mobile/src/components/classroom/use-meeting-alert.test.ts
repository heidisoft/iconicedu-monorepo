import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useMeetingAlert } from './use-meeting-alert';

it('opens one dialog for repeated taps and releases it on the first cancel', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const cancel = jest.fn();
  const { result } = renderHook(useMeetingAlert);
  act(() => {
    for (let i = 0; i < 3; i++)
      result.current('Leave?', '', [{ text: 'Cancel', onPress: cancel }]);
  });
  expect(alert).toHaveBeenCalledTimes(1);
  act(() => alert.mock.calls[0][2]?.[0].onPress?.());
  expect(cancel).toHaveBeenCalledTimes(1);
  act(() => result.current('Stop whiteboard?'));
  expect(alert).toHaveBeenCalledTimes(2);
  act(() => alert.mock.calls[1][3]?.onDismiss?.());
  act(() => result.current('Leave?'));
  expect(alert).toHaveBeenCalledTimes(3);
  alert.mockRestore();
});
