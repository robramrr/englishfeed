const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
] as const;

/** Pick the first MediaRecorder mime type this browser actually supports. */
export function pickRecordingMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

export function recordingFilenameForMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("mp4") || lower.includes("aac")) return "recording.m4a";
  if (lower.includes("ogg")) return "recording.ogg";
  return "recording.webm";
}

export function createMediaRecorder(
  stream: MediaStream
): { recorder: MediaRecorder; mimeType: string } {
  const preferred = pickRecordingMimeType();
  if (preferred) {
    return {
      recorder: new MediaRecorder(stream, { mimeType: preferred }),
      mimeType: preferred,
    };
  }
  const recorder = new MediaRecorder(stream);
  return { recorder, mimeType: recorder.mimeType || "audio/webm" };
}

/** Flush any buffered audio before stopping (needed on some browsers). */
export function stopMediaRecorder(recorder: MediaRecorder): void {
  if (recorder.state === "inactive") return;
  try {
    recorder.requestData();
  } catch {
    // requestData is not available on every browser
  }
  recorder.stop();
}

export async function openMicStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const tracks = stream.getAudioTracks();
  if (tracks.length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("No microphone track available.");
  }
  const track = tracks[0]!;
  if (track.readyState !== "live") {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Microphone is not active.");
  }
  return stream;
}

/**
 * Wire the analyser into the audio graph without audible output.
 * Some browsers skip processing unless the graph reaches the destination.
 */
export function connectAnalyserForMonitoring(
  source: MediaStreamAudioSourceNode,
  analyser: AnalyserNode,
  audioContext: AudioContext
): void {
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  source.connect(analyser);
  analyser.connect(silentGain);
  silentGain.connect(audioContext.destination);
}

/** Buffer length required by AnalyserNode.getByteTimeDomainData (must be fftSize). */
export function createTimeDomainBuffer(analyser: AnalyserNode): Uint8Array {
  return new Uint8Array(analyser.fftSize);
}

/** Peak amplitude from a time-domain buffer (0 = silence, 128 = max). */
export function peakFromTimeDomain(data: Uint8Array): number {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const amp = Math.abs(data[i]! - 128);
    if (amp > peak) peak = amp;
  }
  return peak;
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}
