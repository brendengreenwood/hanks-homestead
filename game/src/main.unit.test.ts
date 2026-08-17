import { describe, expect, it } from 'vitest';
import {
  CAMERA_FAR,
  CAMERA_NEAR,
  CAMERA_POSITION,
  CAMERA_ZOOM,
  FIELD_OFFSET,
  FIELD_SIZE,
  WORLD_SIZE,
  gridToWorld,
} from './constants';

describe('world/camera constants (legacy parity)', () => {
  it('exports the legacy grid dimensions', () => {
    expect(WORLD_SIZE).toBe(36);
    expect(FIELD_SIZE).toBe(10);
    expect(FIELD_OFFSET).toBe(13);
  });

  it('exports the legacy iso camera framing', () => {
    expect(CAMERA_POSITION).toEqual([24, 26, 24]);
    expect(CAMERA_ZOOM).toBe(26);
    expect(CAMERA_NEAR).toBe(-50);
    expect(CAMERA_FAR).toBe(200);
  });

  it('re-centers grid coords on the origin', () => {
    // worldX = gridX - WORLD_SIZE/2 + 0.5
    expect(gridToWorld(0, 0)).toEqual([-17.5, -17.5]);
    expect(gridToWorld(35, 35)).toEqual([17.5, 17.5]);
    expect(gridToWorld(18, 13)).toEqual([0.5, -4.5]);
  });
});
