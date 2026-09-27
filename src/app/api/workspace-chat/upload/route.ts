import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form      = await req.formData();
  const file      = form.get("file") as File;
  const messageId = form.get("messageId") as string;

  if (!file || !messageId) {
    return NextResponse.json({ error: "file and messageId required" }, { status: 400 });
  }

  const bytes    = await file.arrayBuffer();
  const buffer   = Buffer.from(bytes);
  const ext      = file.name.split(".").pop() ?? "bin";
  const path     = `chat/${messageId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(path, buffer, { contentType: file.type });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from("chat-attachments")
    .getPublicUrl(path);

  const attachment = await db.messageAttachment.create({
    data: {
      messageId,
      name:     file.name,
      url:      publicUrl,
      size:     file.size,
      mimeType: file.type,
    },
  });

  return NextResponse.json({ attachment });
}