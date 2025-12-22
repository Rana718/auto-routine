"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Store, Users, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { OrdersTable } from "@/components/dashboard/OrdersTable";
import { StaffOverview } from "@/components/dashboard/StaffOverview";
import { CutoffTimer } from "@/components/dashboard/CutoffTimer";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ordersApi, staffApi, storesApi } from "@/lib/api";
import type { OrderWithItems, OrderStats, StaffWithStats, StoreStats } from "@/lib/types";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [staffList, setStaffList] = useState<StaffWithStats[]>([]);
  const [storeStats, setStoreStats] = useState<StoreStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderWithItems[]>([]);

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const todayISO = today.toISOString().split("T")[0];

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [ordersStatsRes, staffRes, storesStatsRes, ordersRes] = await Promise.all([
          ordersApi.getStats(todayISO).catch(() => null),
          staffApi.getAll({ active_only: true }).catch(() => []),
          storesApi.getStats().catch(() => null),
          ordersApi.getAll({ limit: 10, target_date: todayISO }).catch(() => []),
        ]);

        setOrderStats(ordersStatsRes);
        setStaffList(staffRes);
        setStoreStats(storesStatsRes);
        setRecentOrders(ordersRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [todayISO]);

  if (loading) {
    return (
      <MainLayout title="ダッシュボード" subtitle={`${dateStr} — 本日の買付概要`}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title="ダッシュボード" subtitle={`${dateStr} — 本日の買付概要`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary hover:underline"
            >
              再読み込み
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const totalOrders = orderStats?.total_orders || 0;
  const completedOrders = orderStats?.completed_orders || 0;
  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const activeStaff = staffList.filter((s) => s.status !== "off_duty").length;

  return (
    <MainLayout
      title="ダッシュボード"
      subtitle={`${dateStr} — 本日の買付概要`}
    >
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="本日の注文数"
          value={totalOrders}
          subtitle="本日"
          icon={ShoppingCart}
          variant="primary"
        />
        <StatCard
          title="訪問予定店舗"
          value={storeStats?.stores_with_orders || 0}
          subtitle={`${storeStats?.active_stores || 0}店舗中`}
          icon={Store}
          variant="default"
        />
        <StatCard
          title="稼働中スタッフ"
          value={activeStaff}
          subtitle={`${staffList.length}名中`}
          icon={Users}
          variant="default"
        />
        <StatCard
          title="完了率"
          value={`${completionRate}%`}
          subtitle={`${totalOrders}件中${completedOrders}件`}
          icon={CheckCircle}
          variant="success"
        />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="割当待ち"
          value={orderStats?.pending_orders || 0}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="処理中"
          value={orderStats?.assigned_orders || 0}
          icon={ShoppingCart}
          variant="primary"
        />
        <StatCard
          title="失敗/問題あり"
          value={orderStats?.failed_orders || 0}
          icon={XCircle}
          variant="destructive"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Table - 2 columns */}
        <div className="lg:col-span-2">
          <OrdersTable orders={recentOrders} />
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          <CutoffTimer />
          <QuickActions />
          <StaffOverview staff={staffList} />
        </div>
      </div>
    </MainLayout>
  );
}
