'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
/** Uses the existing preview stream, so this check never requests another microphone. */
export function AudioSelfCheck({
  stream,
  muted,
  speakerId,
}: {
  stream: MediaStream | null;
  muted: boolean;
  speakerId?: string;
}) {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const testContext = useRef<AudioContext | null>(null);
  const meterContext = useRef<AudioContext | null>(null);
  const [needsStart, setNeedsStart] = useState(false);
  useEffect(
    () => () => {
      void testContext.current?.close().catch(() => undefined);
    },
    [],
  );
  const audioTrack = stream?.getAudioTracks()[0];
  useEffect(() => {
    setLevel(0);
    setNeedsStart(false);
    if (muted || !stream || !audioTrack || !window.AudioContext) return;
    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      setError('Microphone testing is unavailable. You can still join the meeting.');
      return;
    }
    meterContext.current = context;
    setNeedsStart(context.state === 'suspended');
    let source: MediaStreamAudioSourceNode;
    try {
      source = context.createMediaStreamSource(stream);
    } catch {
      meterContext.current = null;
      void context.close().catch(() => undefined);
      setError('Could not test the microphone. Turn it off and on to try again.');
      return;
    }
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    void context.resume().catch(() => undefined);
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(
        samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) /
          samples.length,
      );
      setLevel(Math.min(100, Math.round(rms * 400)));
    }, 100);
    return () => {
      clearInterval(timer);
      meterContext.current = null;
      source.disconnect();
      analyser.disconnect();
      void context.close().catch(() => undefined);
    };
  }, [stream, audioTrack, muted]);
  const test = async () => {
    if (testing) return;
    setError(null);
    setTesting(true);
    try {
      await testContext.current?.close();
      const context = new AudioContext();
      testContext.current = context;
      const routed = context as AudioContext & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (speakerId && speakerId !== 'default') {
        if (!routed.setSinkId)
          throw new Error(
            'This browser can only test its default speaker. Choose your output in device settings.',
          );
        await routed.setSinkId(speakerId);
      }
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 440;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.6);
      oscillator.onended = () => {
        void context.close().catch(() => undefined);
        if (testContext.current === context) {
          testContext.current = null;
          setTesting(false);
        }
      };
    } catch (cause) {
      void testContext.current?.close().catch(() => undefined);
      testContext.current = null;
      setTesting(false);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not test the speaker. Check your audio output.',
      );
    }
  };
  return (
    <div
      className="flex w-full flex-wrap items-center gap-3 text-sm"
      aria-label="Audio self-check"
    >
      <div className="min-w-0 flex-1">
        <span>{muted ? 'Microphone is off' : 'Speak to test your microphone'}</span>
        <meter
          aria-label="Microphone activity"
          min={0}
          max={100}
          value={level}
          className="block h-3 w-full"
        />
      </div>
      {needsStart && !muted && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void meterContext.current
              ?.resume()
              .then(() => setNeedsStart(false))
              .catch(() => setError('Could not start the microphone test. Try again.'));
          }}
        >
          Start microphone test
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => void test()} disabled={testing}>
        {testing ? 'Playing test sound…' : 'Test speakers'}
      </Button>
      {error && (
        <p role="alert" className="w-full text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
