import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="text-center space-y-6 animate-slide-up">
                <div className="space-y-2">
                    <h1 className="text-8xl font-bold text-primary">404</h1>
                    <h2 className="text-2xl font-semibold text-foreground">ページが見つかりません</h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        お探しのページは存在しないか、移動された可能性があります。
                    </p>
                </div>

                <div className="flex items-center justify-center gap-4">
                    <Button asChild variant="outline" className="gap-2">
                        <Link href="javascript:history.back()">
                            <ArrowLeft className="h-4 w-4" />
                            戻る
                        </Link>
                    </Button>
                    <Button asChild className="gap-2">
                        <Link href="/">
                            <Home className="h-4 w-4" />
                            ホームへ
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
