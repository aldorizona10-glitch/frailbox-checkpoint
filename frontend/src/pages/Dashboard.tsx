import React from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import { useDashboardStats } from '../hooks';
import type { DashboardStats } from '../types';

interface StatCardConfig {
  key: keyof Pick<
    DashboardStats,
    | 'totalUsers'
    | 'activeSessions'
    | 'trialsCompleted'
    | 'avgResponseTime'
    | 'errorRate'
    | 'uptime'
  >;
  label: string;
  color: string;
  suffix?: string;
}

const statCards: StatCardConfig[] = [
  { key: 'totalUsers', label: 'Total Users', color: '#4f46e5' },
  { key: 'activeSessions', label: 'Active Sessions', color: '#059669' },
  { key: 'trialsCompleted', label: 'Trials Completed', color: '#d97706' },
  { key: 'avgResponseTime', label: 'Avg Response Time', color: '#dc2626', suffix: 'ms' },
  { key: 'errorRate', label: 'Error Rate', color: '#7c3aed', suffix: '%' },
  { key: 'uptime', label: 'Uptime', color: '#0891b2', suffix: '%' },
];

interface StatCardProps {
  card: StatCardConfig;
  stats: DashboardStats | null | undefined;
}

const StatCard: React.FC<StatCardProps> = ({ card, stats }) => (
  <div className="stat-card">
    <div
      className="stat-card-indicator"
      style={{ backgroundColor: card.color }}
    />
    <div className="stat-card-content">
      <span className="stat-card-label">{card.label}</span>
      <span
        className="stat-card-value"
        style={{ color: card.color }}
      >
        {String(stats?.[card.key] ?? ' - ')}
        {card.suffix || ''}
      </span>
    </div>
  </div>
);

interface StatCardsGridProps {
  stats: DashboardStats | null | undefined;
}

const StatCardsGrid: React.FC<StatCardsGridProps> = ({ stats }) => (
  <div className="stats-grid">
    {statCards.map((card) => (
      <StatCard key={card.key} card={card} stats={stats} />
    ))}
  </div>
);

const Dashboard: React.FC = () => {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>Failed to load dashboard: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <ErrorBoundary
      title="Dashboard unavailable"
      message="The dashboard panel could not be rendered."
    >
      <div className="dashboard">
        <div className="dashboard-header">
          <h2>Dashboard</h2>
          <p className="dashboard-subtitle">
            Tent of Trials System Overview
          </p>
        </div>

        <ErrorBoundary
          title="Dashboard stats unavailable"
          message="Live stat cards could not be rendered."
        >
          <StatCardsGrid stats={stats} />
        </ErrorBoundary>

        <div className="dashboard-panels">
          <div className="panel">
            <h3>Recent Activity</h3>
            <div className="panel-placeholder">
              Activity feed will appear here
            </div>
          </div>
          <div className="panel">
            <h3>System Health</h3>
            <div className="panel-placeholder">
              Health metrics will appear here
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
