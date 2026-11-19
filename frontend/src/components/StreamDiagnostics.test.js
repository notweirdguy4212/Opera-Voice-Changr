// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import StreamDiagnostics from './StreamDiagnostics';

afterEach(() => { cleanup(); vi.useRealTimers(); });
it('clears a recent-drop warning even when parent props are recreated', () => {
  vi.useFakeTimers();
  const props = () => ({ streamInfo: { sampleRate: 48000, chunkSize: 2048 }, transport: { dropped: 1 } });
  const view = render(React.createElement(StreamDiagnostics, props()));
  expect(screen.getByText(/Recent audio discontinuities/)).toBeTruthy();
  view.rerender(React.createElement(StreamDiagnostics, props()));
  act(() => vi.advanceTimersByTime(5100));
  expect(screen.queryByText(/Recent audio discontinuities/)).toBeNull();
});

it('gives a specific recommendation when model processing exceeds real-time budget', () => {
  render(React.createElement(StreamDiagnostics, {
    streamInfo: { sampleRate: 48000, chunkSize: 2048 },
    serverMs: 80,
  }));
  expect(screen.getByText(/Processing is slower than real time/)).toBeTruthy();
  expect(screen.getByText(/lighter voice model or F0 method/)).toBeTruthy();
});

it('detects a growing connection queue and recommends network checks', () => {
  render(React.createElement(StreamDiagnostics, {
    streamInfo: { sampleRate: 48000, chunkSize: 2048 },
    transport: { pending: 8 },
  }));
  expect(screen.getByText(/connection queue is building up/)).toBeTruthy();
  expect(screen.getByText(/Wi-Fi stability/)).toBeTruthy();
});

it('reports a healthy stream when no problems are measured', () => {
  render(React.createElement(StreamDiagnostics, {
    streamInfo: { sampleRate: 48000, chunkSize: 2048 },
  }));
  expect(screen.getByText(/Stream looks healthy/)).toBeTruthy();
});
