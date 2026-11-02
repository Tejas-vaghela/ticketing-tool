import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../frontend/src/components/common/StatusBadge';

describe('StatusBadge Component', () => {
  it('should render Open status correctly', () => {
    render(<StatusBadge status="Open" />);
    expect(screen.getByText('Open')).toBeDefined();
    const el = document.getElementById('status-open');
    expect(el).not.toBeNull();
  });

  it('should render In Progress status correctly', () => {
    render(<StatusBadge status="In Progress" />);
    expect(screen.getByText('In Progress')).toBeDefined();
    const el = document.getElementById('status-in-progress');
    expect(el).not.toBeNull();
  });

  it('should render Resolved status correctly', () => {
    render(<StatusBadge status="Resolved" />);
    expect(screen.getByText('Resolved')).toBeDefined();
    const el = document.getElementById('status-resolved');
    expect(el).not.toBeNull();
  });

  it('should render Closed status correctly', () => {
    render(<StatusBadge status="Closed" />);
    expect(screen.getByText('Closed')).toBeDefined();
    const el = document.getElementById('status-closed');
    expect(el).not.toBeNull();
  });

  it('should apply small size classes when size="sm"', () => {
    render(<StatusBadge status="To Do" size="sm" />);
    const el = document.getElementById('status-to-do');
    expect(el?.className).toContain('text-[10px]');
  });
});

