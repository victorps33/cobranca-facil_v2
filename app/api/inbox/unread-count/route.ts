import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function GET() {
  const { error, tenantId, session } = await requireTenant();
  if (error) return error;

  try {
    const userId = session!.user.id;

    // Get all active conversations for this tenant
    const conversations = await prisma.conversation.findMany({
      where: {
        franqueadoraId: tenantId!,
        status: { not: "RESOLVIDA" },
      },
      select: {
        id: true,
        lastMessageAt: true,
        readReceipts: {
          where: { userId },
          select: { lastReadAt: true },
        },
      },
    });

    // Count conversations where lastMessageAt > lastReadAt (or no read receipt)
    const unreadCount = conversations.filter((c) => {
      const receipt = c.readReceipts[0];
      if (!receipt) return true;
      return c.lastMessageAt > receipt.lastReadAt;
    }).length;

    return NextResponse.json({ unreadCount });
  } catch (err) {
    console.error("[Inbox] Unread count error:", err);
    return NextResponse.json({ unreadCount: 0 });
  }
}
