export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Negate parent padding (main has p-6 lg:p-8) and set fixed height
  // based on viewport minus the TopBar (h-16 = 4rem).
  // overflow-hidden prevents the parent scroll from interfering.
  return (
    <div className="-m-6 lg:-m-8 overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
      {children}
    </div>
  );
}
