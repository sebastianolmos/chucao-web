const MIN_VOLUME = 0;
const MAX_VOLUME = 100;
const MIN_AUDIBLE_VOLUME = 1;
const MID_VOLUME = 50;
const MIN_DECIBELS = -60;
const MID_DECIBELS = -30;
const MAX_DECIBELS = 0;

function assertValidVolume(value: unknown): asserts value is number {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < MIN_VOLUME
    || value > MAX_VOLUME
  ) {
    throw new RangeError('Sound volume must be a whole number from 0 to 100.');
  }
}

export function volumeToDecibels(volume: number): number | null {
  assertValidVolume(volume);

  if (volume === MIN_VOLUME) {
    return null;
  }

  if (volume <= MID_VOLUME) {
    const step = (volume - MIN_AUDIBLE_VOLUME) / (MID_VOLUME - MIN_AUDIBLE_VOLUME);
    return MIN_DECIBELS + step * (MID_DECIBELS - MIN_DECIBELS);
  }

  const step = (volume - MID_VOLUME) / (MAX_VOLUME - MID_VOLUME);
  return MID_DECIBELS + step * (MAX_DECIBELS - MID_DECIBELS);
}

export function volumeToGain(volume: number): number {
  const decibels = volumeToDecibels(volume);
  return decibels === null ? 0 : 10 ** (decibels / 20);
}
