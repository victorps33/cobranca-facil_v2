import dynamic from "next/dynamic";

const DashboardPage = dynamic(
  () => import("./dashboard-client").then((m) => m.DashboardPage),
  { ssr: false }
);

export default function Page() {
  return <DashboardPage />;
}
