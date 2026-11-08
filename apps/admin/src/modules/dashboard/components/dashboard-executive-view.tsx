import React from 'react';
import { DashboardKpiGrid } from './dashboard-kpi-grid';
import { DashboardRevenueChart } from './dashboard-revenue-chart';
import { DashboardRecentTransactions } from './dashboard-recent-transactions';
import { initialKpiMetrics, initialRecentTransactions, initialRevenueChartPoints } from '../data/dashboard-data';

export const DashboardExecutiveView: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 4 KPIs Apple Grid */}
      <DashboardKpiGrid metrics={initialKpiMetrics} />

      {/* Revenue Chart Section */}
      <DashboardRevenueChart points={initialRevenueChartPoints} />

      {/* Recent Transactions Table */}
      <DashboardRecentTransactions transactions={initialRecentTransactions} />
    </div>
  );
};
