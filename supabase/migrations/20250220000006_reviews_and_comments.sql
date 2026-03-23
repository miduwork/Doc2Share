-- Reviews (chỉ người đã mua mới được đánh giá - Docs_Chiến lược SEO)
CREATE TABLE IF NOT EXISTS document_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, document_id)
);

-- Thảo luận dưới mỗi tài liệu (chỉ người mua - Docs_Cộng đồng mạng)
CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_reviews_document ON document_reviews(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_document ON document_comments(document_id);

ALTER TABLE document_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- Ai cũng xem được reviews và comments
CREATE POLICY "Anyone can view document_reviews"
  ON document_reviews FOR SELECT USING (true);
CREATE POLICY "Purchasers can insert document_reviews"
  ON document_reviews FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM permissions p WHERE p.user_id = auth.uid() AND p.document_id = document_reviews.document_id)
  );
CREATE POLICY "Users can update own document_reviews"
  ON document_reviews FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view document_comments"
  ON document_comments FOR SELECT USING (true);
CREATE POLICY "Purchasers can insert document_comments"
  ON document_comments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM permissions p WHERE p.user_id = auth.uid() AND p.document_id = document_comments.document_id)
  );
CREATE POLICY "Users can delete own document_comments"
  ON document_comments FOR DELETE USING (auth.uid() = user_id);
