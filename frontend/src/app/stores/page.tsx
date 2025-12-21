"use client";

import { useState } from "react";
import { Search, MapPin, Clock, Star, Plus, Filter } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Store {
    id: string;
    name: string;
    address: string;
    district: string;
    category: string;
    operatingHours: string;
    distance: string;
    priority: number;
    ordersToday: number;
    status: "open" | "closed" | "unknown";
}

const mockStores: Store[] = [
    { id: "1", name: "家電プラザ渋谷", address: "渋谷区神南1-21-3", district: "渋谷", category: "家電", operatingHours: "10:00 - 21:00", distance: "2.3 km", priority: 1, ordersToday: 8, status: "open" },
    { id: "2", name: "ビックカメラ有楽町", address: "千代田区有楽町1-11-1", district: "千代田", category: "家電", operatingHours: "10:00 - 22:00", distance: "4.1 km", priority: 2, ordersToday: 5, status: "open" },
    { id: "3", name: "グルメマーケット銀座", address: "中央区銀座4-6-16", district: "銀座", category: "食品・飲料", operatingHours: "09:00 - 20:00", distance: "3.8 km", priority: 1, ordersToday: 12, status: "open" },
    { id: "4", name: "テックハブ秋葉原", address: "千代田区外神田1-15-4", district: "秋葉原", category: "家電", operatingHours: "11:00 - 20:00", distance: "5.2 km", priority: 3, ordersToday: 3, status: "open" },
    { id: "5", name: "無印良品 新宿", address: "新宿区新宿3-15-15", district: "新宿", category: "生活雑貨", operatingHours: "10:00 - 21:00", distance: "3.0 km", priority: 2, ordersToday: 6, status: "open" },
    { id: "6", name: "特選食品 代官山", address: "渋谷区猿楽町17-6", district: "代官山", category: "食品・飲料", operatingHours: "10:00 - 19:00", distance: "2.8 km", priority: 2, ordersToday: 4, status: "open" },
    { id: "7", name: "ユニクロ銀座", address: "中央区銀座5-7-7", district: "銀座", category: "ファッション", operatingHours: "11:00 - 21:00", distance: "4.0 km", priority: 1, ordersToday: 9, status: "open" },
    { id: "8", name: "伊東屋", address: "中央区銀座2-7-15", district: "銀座", category: "文房具", operatingHours: "10:00 - 20:00", distance: "3.9 km", priority: 3, ordersToday: 2, status: "closed" },
];

const categoryColors: Record<string, string> = {
    家電: "bg-blue-500/20 text-blue-400",
    "食品・飲料": "bg-green-500/20 text-green-400",
    生活雑貨: "bg-purple-500/20 text-purple-400",
    ファッション: "bg-pink-500/20 text-pink-400",
    文房具: "bg-amber-500/20 text-amber-400",
};

export default function StoresPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");

    const categories = [...new Set(mockStores.map((s) => s.category))];

    const filteredStores = mockStores.filter((store) => {
        const matchesSearch =
            store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            store.district.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === "all" || store.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <MainLayout title="店舗一覧" subtitle={`東京都内 ${mockStores.length}店舗`}>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground">店舗総数</p>
                    <p className="text-2xl font-bold text-foreground">{mockStores.length}</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/10 p-4">
                    <p className="text-sm text-muted-foreground">営業中</p>
                    <p className="text-2xl font-bold text-success">
                        {mockStores.filter((s) => s.status === "open").length}
                    </p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                    <p className="text-sm text-muted-foreground">本日訪問予定</p>
                    <p className="text-2xl font-bold text-primary">
                        {mockStores.filter((s) => s.ordersToday > 0).length}
                    </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground">総注文数</p>
                    <p className="text-2xl font-bold text-foreground">
                        {mockStores.reduce((acc, s) => acc + s.ordersToday, 0)}
                    </p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="店舗名またはエリアで検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 rounded-lg border border-border bg-secondary pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all"
                    />
                </div>
                <div className="flex gap-3">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">全カテゴリ</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        詳細フィルター
                    </Button>
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        店舗追加
                    </Button>
                </div>
            </div>

            {/* Store Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredStores.map((store, index) => (
                    <div
                        key={store.id}
                        className="rounded-xl border border-border bg-card p-4 card-shadow hover:elevated-shadow transition-all duration-200 animate-slide-up"
                        style={{ animationDelay: `${index * 30}ms` }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground truncate">{store.name}</h3>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate">{store.district}</span>
                                </div>
                            </div>
                            <Badge
                                className={cn(
                                    "shrink-0 ml-2",
                                    store.status === "open"
                                        ? "bg-success/20 text-success"
                                        : "bg-destructive/20 text-destructive"
                                )}
                            >
                                {store.status === "open" ? "営業中" : "閉店"}
                            </Badge>
                        </div>

                        {/* Category */}
                        <Badge className={cn("mb-3", categoryColors[store.category] || "bg-secondary")}>
                            {store.category}
                        </Badge>

                        {/* Details */}
                        <div className="space-y-2 mb-4 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{store.operatingHours}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>オフィスから {store.distance}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Star className="h-3.5 w-3.5" />
                                <span>優先度: {store.priority}</span>
                            </div>
                        </div>

                        {/* Orders Badge */}
                        {store.ordersToday > 0 && (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
                                <span className="text-sm text-primary font-medium">
                                    本日 {store.ordersToday}件の注文
                                </span>
                                <Button variant="ghost" size="sm" className="h-7 text-primary hover:text-primary">
                                    表示
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </MainLayout>
    );
}
