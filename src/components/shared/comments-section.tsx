/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  createdAt: Date;
  user: {
    name: string | null;
    email: string;
    imageUrl: string | null;
  };
}

interface CommentsSectionProps {
  videoId: string;
  initialComments: Comment[];
}

export function CommentsSection({
  videoId,
  initialComments,
}: CommentsSectionProps) {
  const { user, isSignedIn } = useUser();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || !isSignedIn) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Failed to post comment");

      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setContent("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">
          {comments.length} comment{comments.length !== 1 ? "s" : ""}
        </h2>
      </div>

      {/* comment input */}
      {isSignedIn ? (
        <div className="mb-6 space-y-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={user.imageUrl} />
              <AvatarFallback className="text-xs">
                {user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Textarea
              placeholder="Leave a comment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!content.trim() || submitting}
            >
              {submitting ? "Posting..." : "Post comment"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">
            <a href="/sign-in" className="text-primary hover:underline">
              Sign in
            </a>{" "}
            to leave a comment
          </p>
        </div>
      )}

      {/* comments list */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No comments yet. Be the first.
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={comment.user.imageUrl ?? ""} />
                <AvatarFallback className="text-xs">
                  {comment.user.name?.[0] ??
                    comment.user.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">
                    {comment.user.name ?? comment.user.email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}