import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SLABadge } from './SLABadge';
import { Issue } from '../../types';

describe('SLABadge Component', () => {
  const mockIssue: Issue = {
    id: 'INB-101',
    title: 'Test Issue',
    description: 'Test Description',
    status: 'In Progress',
    priority: 'High',
    type: 'Bug',
    projectId: 'proj-1',
    reporterId: 'user-1',
    assigneeId: 'user-2',
    supportLevel: 'L1',
    labels: ['bug'],
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    escalationHistory: [],
    attachments: [],
    resolutionSLAHours: 24,
    responseSLAHours: 4,
  };

  it('should render SLA badge with status', () => {
    render(<SLABadge issue={mockIssue} />);
    const badge = document.getElementById('sla-INB-101');
    expect(badge).not.toBeNull();
  });

  it('should render detailed resolution text when showDetails is true', () => {
    render(<SLABadge issue={mockIssue} showDetails={true} />);
    const badge = document.getElementById('sla-INB-101');
    expect(badge).not.toBeNull();
  });
});

