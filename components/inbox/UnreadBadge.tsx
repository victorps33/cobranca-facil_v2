"use client";

import { useState, useEffect } from "react";

export function UnreadBadge({ collapsed }: { collapsed?: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => {
      fetch("/api/inbox/unread-count")
        .then((res) => res.json())
        .then((data) => setCount(data.unreadCount || 0))
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  if (collapsed) {
    return (
      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-primary text-white text-[9px] font-bold px-1">
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary text-white text-[10px] font-bold px-1.5">
      {count > 99 ? "99+" : count}
    </span>
  );
}
