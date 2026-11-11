declare module "zzfx" {
  export const ZZFX: {
    volume: number;
    sampleRate: number;
    audioContext: AudioContext;
    buildSamples(...params: number[]): number[] | Float32Array;
  };
  export function zzfx(...params: number[]): AudioBufferSourceNode;
}
