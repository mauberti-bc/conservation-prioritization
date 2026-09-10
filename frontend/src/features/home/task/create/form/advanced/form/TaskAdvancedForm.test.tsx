/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OPTIMIZATION_MODE } from 'hooks/interfaces/useTaskApi.interface';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskAdvancedForm } from './TaskAdvancedForm';

const mocks = vi.hoisted(() => ({ setFieldValue: vi.fn() }));

vi.mock('formik', () => ({
  useFormikContext: () => ({
    values: {
      resolution: 240,
      optimizationMode: OPTIMIZATION_MODE.INTERACTIVE,
      neighborPenaltyEnabled: false,
      neighborPenaltyStrength: 1,
    },
    setFieldValue: mocks.setFieldValue,
  }),
}));

describe('TaskAdvancedForm resolution selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it.each(['30 m — highest cost', '60 m'])('keeps %s visible but rejects clicks', (label) => {
    render(<TaskAdvancedForm />);
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);

    const option = screen.getByRole('option', { name: label });
    expect(option.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(option);

    expect(mocks.setFieldValue).not.toHaveBeenCalled();
  });

  it('allows selecting 120 m', () => {
    render(<TaskAdvancedForm />);
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByRole('option', { name: '120 m' }));

    expect(mocks.setFieldValue).toHaveBeenCalledWith('resolution', 120);
  });
});
