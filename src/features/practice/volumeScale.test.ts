import { describe, expect, it } from 'vitest';
import { volumeToDecibels, volumeToGain } from './volumeScale';

describe('timer sound volume scale', () => {
  it('maps the UI anchors to mute, -60 dB, -30 dB, and app maximum', () => {
    expect(volumeToDecibels(0)).toBeNull();
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToDecibels(1)).toBe(-60);
    expect(volumeToDecibels(50)).toBe(-30);
    expect(volumeToDecibels(100)).toBe(0);
    expect(volumeToGain(50)).toBeCloseTo(10 ** (-30 / 20), 12);
    expect(volumeToGain(100)).toBe(1);
  });

  it('is strictly increasing for every audible slider value', () => {
    const gains = Array.from({ length: 101 }, (_, volume) => volumeToGain(volume));

    expect(gains[0]).toBe(0);
    expect(gains.slice(1).every((gain, index) => gain > gains[index]!)).toBe(true);
  });

  it.each([-1, 101, 1.5, Number.NaN, '50', null])(
    'rejects invalid volume %s',
    (volume) => {
      expect(() => volumeToDecibels(volume as number)).toThrow(RangeError);
      expect(() => volumeToGain(volume as number)).toThrow(RangeError);
    },
  );
});
