import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriorityBadge } from '../../frontend/src/components/common/PriorityBadge';

describe('PriorityBadge Component', () => {
  it('should render Highest priority with label', () => {
    render(<PriorityBadge priority="Highest" />);
    expect(screen.getByText('Highest')).toBeDefined();
    const element = screen.getByTitle('Priority: Highest');
    expect(element).toBeDefined();
    expect(element.id).toBe('priority-highest');
  });

  it('should render High priority', () => {
    render(<PriorityBadge priority="High" />);
    expect(screen.getByText('High')).toBeDefined();
    expect(screen.getByTitle('Priority: High')).toBeDefined();
  });

  it('should render Medium priority', () => {
    render(<PriorityBadge priority="Medium" />);
    expect(screen.getByText('Medium')).toBeDefined();
    expect(screen.getByTitle('Priority: Medium')).toBeDefined();
  });

  it('should render Low priority', () => {
    render(<PriorityBadge priority="Low" />);
    expect(screen.getByText('Low')).toBeDefined();
    expect(screen.getByTitle('Priority: Low')).toBeDefined();
  });

  it('should render Lowest priority', () => {
    render(<PriorityBadge priority="Lowest" />);
    expect(screen.getByText('Lowest')).toBeDefined();
    expect(screen.getByTitle('Priority: Lowest')).toBeDefined();
  });

  it('should hide text when showText is false', () => {
    render(<PriorityBadge priority="Highest" showText={false} />);
    expect(screen.queryByText('Highest')).toBeNull();
    expect(screen.getByTitle('Priority: Highest')).toBeDefined();
  });
});

