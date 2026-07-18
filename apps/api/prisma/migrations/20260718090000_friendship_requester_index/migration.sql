-- Covers the reverse-direction edge lookup in FriendsService.edge()
-- (the WHERE requesterId = A OR ... requesterId = B branch).
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");
