import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { LoginPage } from '../pages/LoginPage';

describe('Client Authentication UI', () => {
  it('renders login page with email, password, and quick demo credentials', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/Welcome to AdaptIQ/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@domain.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();

    // Verify quick demo buttons
    expect(screen.getByRole('button', { name: /Candidate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recruiter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Admin/i })).toBeInTheDocument();
  });
});
