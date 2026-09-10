/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrawControls, DrawControlsProps } from './DrawControls';

const mocks = vi.hoisted(() => ({
  deleteAll: vi.fn(),
  changeMode: vi.fn(),
  getAll: vi.fn(),
  canvas: { style: { cursor: 'crosshair' } },
}));

vi.mock('hooks/useContext', () => ({
  useMapContext: () => ({
    mapRef: { current: { getCanvas: () => mocks.canvas } },
    drawRef: { current: { deleteAll: mocks.deleteAll, changeMode: mocks.changeMode, getAll: mocks.getAll } },
    isMapReady: false,
  }),
}));

describe('DrawControls cleanup', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('clears geometry using the public API and exits drawing mode', () => {
    const ref = createRef<DrawControlsProps>();
    render(<DrawControls ref={ref} />);

    act(() => ref.current?.clearDrawing());

    expect(mocks.deleteAll).toHaveBeenCalledOnce();
    expect(mocks.changeMode).toHaveBeenCalledWith('simple_select');
    expect(mocks.canvas.style.cursor).toBe('');
  });

  it('forgets submitted feature IDs when starting a fresh task', () => {
    const ref = createRef<DrawControlsProps>();
    const feature = { type: 'Feature', id: 'area-1', geometry: null, properties: {} };
    mocks.getAll.mockReturnValue({ features: [feature] });
    render(<DrawControls ref={ref} />);
    const first = vi.fn();
    const second = vi.fn();

    act(() => {
      ref.current?.submit(first);
      ref.current?.clearDrawing();
      ref.current?.submit(second);
    });

    expect(first).toHaveBeenCalledWith([feature]);
    expect(second).toHaveBeenCalledWith([feature]);
  });
});
