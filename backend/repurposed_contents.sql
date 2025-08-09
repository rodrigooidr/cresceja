CREATE TABLE repurposed_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES social_media_posts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'story', 'video', 'email', 'alt_caption'
  content TEXT NOT NULL,
  media_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);