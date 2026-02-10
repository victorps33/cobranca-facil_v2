export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Override the dashboard layout's padding and max-width for the inbox
  // The inbox shell fills the entire content area
  return (
    <div className="-m-6 lg:-m-8 h-[calc(100%+3rem)] lg:h-[calc(100%+4rem)]">
      {children}
    </div>
  );
}
