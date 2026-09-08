import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMe } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData({ queryKey: ["me"], queryFn: () => getMe() });
    if (!me.isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: () => <Outlet />,
});
