"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Store, Users, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { OrdersTable } from "@/components/dashboard/OrdersTable";
import { StaffOverview } from "@/components/dashboard/StaffOverview";
import { CutoffTimer } from "@/components/dashboard/CutoffTimer";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { dashboardApi } from "@/lib/api";
import type { OrderWithItems, OrderStats, StaffWithStats, StoreStats } from "@/lib/types";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [staffList, setStaffList] = useState<StaffWithStats[]>([]);
  const [storeStats, setStoreStats] = useState<StoreStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderWithItems[]>([]);

  // Use Japan timezone for all date calculations
  const now = new Date();
  const japanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const dateStr = `${japanTime.getFullYear()}年${japanTime.getMonth() + 1}月${japanTime.getDate()}日`;
  const todayISO = japanTime.toISOString().split("T")[0];

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Single API call instead of 4 separate calls
        const data = await dashboardApi.getAll(todayISO);
        
        setOrderStats(data.order_stats);
        setStaffList(data.staff_list);
        setStoreStats(data.store_stats);
        setRecentOrders(data.recent_orders);
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
      {/* Stats Row - 1 col on mobile, 2 on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
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

      {/* Status Overview - 1 col on mobile, 3 on tablet+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
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

      {/* Main Content Grid - stacked on mobile, 3-col layout on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Orders Table - full width on mobile, 2 columns on lg+ */}
        <div className="lg:col-span-2">
          <OrdersTable orders={recentOrders} />
        </div>

        {/* Sidebar - full width on mobile, 1 column on lg+ */}
        <div className="space-y-4 md:space-y-6">
          <CutoffTimer />
          <QuickActions />
          <StaffOverview staff={staffList} />
        </div>
      </div>
    </MainLayout>
  );
}
