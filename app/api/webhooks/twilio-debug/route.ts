import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/agent/providers/twilio";

export async function POST(request: Request) {
  const steps: string[] = [];

  try {
    // Step 1: Parse form data
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries()) as Record<string, string>;
    steps.push(`1. FormData parsed: From=${body.From}, Body=${body.Body?.slice(0, 30)}`);

    // Step 2: Check env vars
    steps.push(`2. ENV: DATABASE_URL=${!!process.env.DATABASE_URL}, TWILIO_AUTH_TOKEN=${!!process.env.TWILIO_AUTH_TOKEN}, NEXTAUTH_URL=${process.env.NEXTAUTH_URL || "NOT SET"}`);

    // Step 3: Test Prisma connection
    const franqCount = await prisma.franqueadora.count();
    steps.push(`3. Prisma OK. Franqueadoras: ${franqCount}`);

    // Step 4: Normalize phone
    const from = body.From || "";
    const normalizedPhone = normalizePhone(from);
    const phoneDigits = normalizedPhone.replace("+55", "");
    steps.push(`4. Normalized: ${normalizedPhone}, digits: ${phoneDigits}`);

    // Step 5: Search customer
    const customer = await prisma.customer.findFirst({
      where: { phone: { contains: phoneDigits } },
    });
    steps.push(`5. Customer search (contains ${phoneDigits}): ${customer ? customer.name + " (id:" + customer.id + ")" : "NOT FOUND"}`);

    // Step 6: Find franqueadora for auto-create
    if (!customer) {
      const franq = await prisma.franqueadora.findFirst();
      steps.push(`6. Default franqueadora: ${franq ? franq.id + " " + franq.nome : "NOT FOUND"}`);

      if (franq) {
        const newCustomer = await prisma.customer.create({
          data: {
            name: body.ProfileName || normalizedPhone,
            doc: "",
            email: "",
            phone: normalizedPhone,
            franqueadoraId: franq.id,
          },
        });
        steps.push(`7. Customer created: ${newCustomer.id}`);

        const conversation = await prisma.conversation.create({
          data: {
            customerId: newCustomer.id,
            franqueadoraId: franq.id,
            channel: "WHATSAPP",
            status: "ABERTA",
            lastMessageAt: new Date(),
          },
        });
        steps.push(`8. Conversation created: ${conversation.id}`);

        const message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: "CUSTOMER",
            content: body.Body || "debug test",
            contentType: "text",
            channel: "WHATSAPP",
            externalId: body.MessageSid || "debug",
          },
        });
        steps.push(`9. Message created: ${message.id}`);
      }
    } else {
      steps.push(`6. Customer exists, skipping create`);
    }

    return NextResponse.json({ success: true, steps });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 3) : [];
    steps.push(`ERROR: ${message}`);
    return NextResponse.json({ success: false, steps, error: message, stack }, { status: 500 });
  }
}

export async function GET() {
  try {
    const count = await prisma.franqueadora.count();
    return NextResponse.json({
      db: "connected",
      franqueadoras: count,
      env: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({
      db: "FAILED",
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
