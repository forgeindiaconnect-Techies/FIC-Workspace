import React from 'react';
import { getSession } from '../lib/api';
import AdminTasksDashboard from './AdminTasksDashboard';
import MemberTasksDashboard from './MemberTasksDashboard';

export default function Tasks() {
  const { user } = getSession();

  if (user?.email === 'admin@fic.com') {
    return <AdminTasksDashboard />;
  }

  // Use the new member dashboard for all other users
  return <MemberTasksDashboard />;
}
