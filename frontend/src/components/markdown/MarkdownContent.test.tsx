/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownContent } from './MarkdownContent';

describe('MarkdownContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders supported Markdown blocks and inline formatting', () => {
    render(
      <MemoryRouter>
        <MarkdownContent
          markdown={`
# Tutorial

Welcome to the **Conservation Prioritization Tool** with *guided steps*.

## Conservation planning workflow

- Define an area of interest
- Explore [results](/map)
`.trim()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Tutorial' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Conservation planning workflow' })).toBeTruthy();
    expect(screen.getByText('Conservation Prioritization Tool')).toBeTruthy();
    expect(screen.getByText('guided steps')).toBeTruthy();
    expect(screen.getByText('Define an area of interest')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'results' }).getAttribute('href')).toBe('/map');
  });

  it('does not render raw HTML as executable elements', () => {
    const { container } = render(
      <MemoryRouter>
        <MarkdownContent
          markdown={`
# Tutorial

<script>alert('x')</script>

<section>Unsafe HTML</section>
`.trim()}
        />
      </MemoryRouter>
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('section')).toBeNull();
    expect(screen.getByText("<script>alert('x')</script>")).toBeTruthy();
    expect(screen.getByText('<section>Unsafe HTML</section>')).toBeTruthy();
  });

  it('renders unsafe links as text only', () => {
    render(
      <MemoryRouter>
        <MarkdownContent markdown="[unsafe](javascript:alert)" />
      </MemoryRouter>
    );

    expect(screen.getByText('unsafe')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'unsafe' })).toBeNull();
  });
});
