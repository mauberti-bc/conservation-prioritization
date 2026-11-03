/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskAreaSection } from './TaskAreaSection';

const mocks = vi.hoisted(() => ({
  getMode: vi.fn(),
  startDrawing: vi.fn(),
  submit: vi.fn(),
  setFieldValue: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));
const canvas = document.createElement('canvas');
const mapRef = { current: { getCanvas: () => canvas, on: mocks.on, off: mocks.off } };
const drawRef = { current: { getMode: mocks.getMode } };
const drawControlsRef = { current: { startDrawing: mocks.startDrawing, submit: mocks.submit } };
const values = { targetArea: [] };

vi.mock('hooks/useContext', () => ({
  useConfigContext: () => ({ FEATURE_FLAGS: [] }),
  useMapContext: () => ({ mapRef, drawRef, drawControlsRef, isMapReady: true }),
}));
vi.mock('formik', () => ({ useFormikContext: () => ({ values, setFieldValue: mocks.setFieldValue }) }));
vi.mock('./geometry/TaskGeometryForm', () => ({ TaskGeometryForm: () => null }));

/**
 * Emits an event to the currently attached map listeners.
 *
 * @param {string} eventName Map event whose registered listeners should be invoked.
 * @returns {void} No return value.
 */
const emitMapEvent = (eventName: string) => {
  const handlers = new Set(mocks.on.mock.calls.filter(([event]) => event === eventName).map(([, handler]) => handler));
  for (const [event, handler] of mocks.off.mock.calls) {
    if (event === eventName) {
      handlers.delete(handler);
    }
  }
  for (const handler of handlers) {
    handler();
  }
};

describe('TaskAreaSection drawing state', () => {
  beforeEach(() => {
    mocks.getMode.mockReturnValue('simple_select');
    mocks.startDrawing.mockImplementation(() => mocks.getMode.mockReturnValue('draw_polygon'));
    mocks.submit.mockImplementation((callback) => {
      mocks.getMode.mockReturnValue('simple_select');
      callback([]);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each(['draw.modechange', 'draw.render'])('syncs the controls when drawing ends through %s', (eventName) => {
    render(<TaskAreaSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Area' }));
    expect(screen.getByRole('button', { name: 'Finish Drawing' })).toBeTruthy();

    mocks.getMode.mockReturnValue('simple_select');
    act(() => emitMapEvent(eventName));

    expect(screen.getByRole('button', { name: 'Add Area' })).toBeTruthy();
    expect(screen.queryByText('Finish Drawing (Press Enter)')).toBeNull();
  });

  it('exits the drawing UI after finishing an incomplete polygon', () => {
    render(<TaskAreaSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Area' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish Drawing' }));

    expect(screen.getByRole('button', { name: 'Add Area' })).toBeTruthy();
    expect(mocks.setFieldValue).not.toHaveBeenCalled();
  });

  it('preserves drawing when Enter is used outside the map', () => {
    render(<TaskAreaSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Area' }));
    fireEvent.keyDown(document.body, { key: 'Enter' });

    expect(mocks.submit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Finish Drawing' })).toBeTruthy();
  });

  it('saves a completed polygon when the map leaves drawing mode', () => {
    const feature = {
      type: 'Feature',
      id: 'area-1',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-130, 50],
            [-129, 50],
            [-129, 51],
            [-130, 50],
          ],
        ],
      },
    };
    mocks.submit.mockImplementation((callback) => callback([feature]));
    render(<TaskAreaSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Area' }));
    mocks.getMode.mockReturnValue('simple_select');
    act(() => emitMapEvent('draw.modechange'));

    expect(mocks.setFieldValue).toHaveBeenCalledWith('targetArea', [
      expect.objectContaining({ geojson: feature, mapboxFeatureId: 'area-1' }),
    ]);
    expect(screen.getByRole('button', { name: 'Add Area' })).toBeTruthy();
  });
});
