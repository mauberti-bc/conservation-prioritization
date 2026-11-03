/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrawControls, DrawControlsProps } from './DrawControls';

const mocks = vi.hoisted(() => ({
  deleteAll: vi.fn(),
  changeMode: vi.fn(),
  getAll: vi.fn(),
  getMode: vi.fn(),
  canvas: { style: { cursor: 'crosshair' } },
  dragPan: { isEnabled: vi.fn(), enable: vi.fn(), disable: vi.fn() },
  on: vi.fn(),
  off: vi.fn(),
}));

vi.mock('hooks/useContext', () => ({
  useMapContext: () => ({
    mapRef: {
      current: {
        getCanvas: () => mocks.canvas,
        getLayer: vi.fn(),
        dragPan: mocks.dragPan,
        on: mocks.on,
        off: mocks.off,
      },
    },
    drawRef: {
      current: {
        deleteAll: mocks.deleteAll,
        changeMode: mocks.changeMode,
        getAll: mocks.getAll,
        getMode: mocks.getMode,
      },
    },
    isMapReady: false,
  }),
}));

describe('DrawControls cleanup', () => {
  beforeEach(() => {
    mocks.getMode.mockReturnValue('simple_select');
  });

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

  it('finalizes the polygon before reading its submitted geometry', () => {
    const ref = createRef<DrawControlsProps>();
    mocks.getMode.mockReturnValue('draw_polygon');
    mocks.getAll.mockReturnValue({ features: [] });
    render(<DrawControls ref={ref} />);

    act(() => ref.current?.submit(vi.fn()));

    expect(mocks.changeMode).toHaveBeenCalledWith('simple_select');
    expect(mocks.changeMode.mock.invocationCallOrder[0]).toBeLessThan(mocks.getAll.mock.invocationCallOrder[0]);
  });

  it('keeps panning enabled and preserves the drawing cursor throughout a pan', () => {
    const ref = createRef<DrawControlsProps>();
    render(<DrawControls ref={ref} />);
    act(() => ref.current?.startDrawing());
    mocks.getMode.mockReturnValue('draw_polygon');

    for (const eventName of ['dragstart', 'drag', 'dragend']) {
      mocks.canvas.style.cursor = 'grab';
      const handler = mocks.on.mock.calls.find(([event]) => event === eventName)![1];
      act(() => handler());
      expect(mocks.canvas.style.cursor).toBe('crosshair');
    }

    // Restarting draw_polygon would discard the polygon's in-progress vertices.
    expect(mocks.changeMode).toHaveBeenCalledExactlyOnceWith('draw_polygon');
    expect(mocks.deleteAll).not.toHaveBeenCalled();
    expect(mocks.dragPan.disable).not.toHaveBeenCalled();
    expect(mocks.dragPan.enable).not.toHaveBeenCalled();
  });

  it('allows completion or cancellation and leaves subsequent pans alone', () => {
    const ref = createRef<DrawControlsProps>();
    render(<DrawControls ref={ref} />);
    act(() => ref.current?.startDrawing());
    const onModeChange = mocks.on.mock.calls.find(([event]) => event === 'draw.modechange')![1];

    act(() => onModeChange({ mode: 'simple_select' }));

    expect(mocks.canvas.style.cursor).toBe('');
    mocks.canvas.style.cursor = 'grab';
    const onDragEnd = mocks.on.mock.calls.find(([event]) => event === 'dragend')![1];
    act(() => onDragEnd());
    expect(mocks.canvas.style.cursor).toBe('grab');
    expect(mocks.changeMode).toHaveBeenCalledExactlyOnceWith('draw_polygon');
  });

  it('removes cursor listeners on unmount without changing pan settings', () => {
    const ref = createRef<DrawControlsProps>();
    const { unmount } = render(<DrawControls ref={ref} />);
    act(() => ref.current?.startDrawing());

    unmount();

    expect(mocks.dragPan.enable).not.toHaveBeenCalled();
    expect(mocks.dragPan.disable).not.toHaveBeenCalled();
    expect(mocks.canvas.style.cursor).toBe('');
    for (const eventName of ['dragstart', 'drag', 'dragend', 'draw.modechange']) {
      const handler = mocks.on.mock.calls.find(([event]) => event === eventName)![1];
      expect(mocks.off).toHaveBeenCalledWith(eventName, handler);
    }
  });
});
