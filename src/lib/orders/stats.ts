import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function getAdminDashboardStats() {
    const admin = createServiceRoleClient();

    const { data: stats, error } = await admin
        .from("orders")
        .select("status, total_amount, payment_status");

    if (error) throw error;

    const totalOrders = stats.length;
    const completedOrders = stats.filter(o => o.status === "completed" || o.payment_status === "Đã thanh toán").length;
    const totalRevenue = stats
        .filter(o => o.status === "completed" || o.payment_status === "Đã thanh toán")
        .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    const pendingOrders = totalOrders - completedOrders;

    return {
        totalOrders,
        completedOrders,
        pendingOrders,
        totalRevenue,
    };
}

export async function getRecentOrders(limit = 10) {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}
