import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypeBadge } from '../../frontend/src/components/common/TypeBadge';

describe('TypeBadge Component', () => {
  it('should render Bug type badge', () => {
    render(<TypeBadge type="Bug" />);
    expect(screen.getByText('Bug')).toBeDefined();
    expect(screen.getByTitle('Type: Bug')).toBeDefined();
  });

  it('should render Story type badge', () => {
    render(<TypeBadge type="Story" />);
    expect(screen.getByText('Story')).toBeDefined();
    expect(screen.getByTitle('Type: Story')).toBeDefined();
  });

  it('should render Task type badge', () => {
    render(<TypeBadge type="Task" />);
    expect(screen.getByText('Task')).toBeDefined();
    expect(screen.getByTitle('Type: Task')).toBeDefined();
  });

  it('should render Epic type badge', () => {
    render(<TypeBadge type="Epic" />);
    expect(screen.getByText('Epic')).toBeDefined();
    expect(screen.getByTitle('Type: Epic')).toBeDefined();
  });

  it('should hide text when showText is false', () => {
    render(<TypeBadge type="Task" showText={false} />);
    expect(screen.queryByText('Task')).toBeNull();
    expect(screen.getByTitle('Type: Task')).toBeDefined();
  });
});

