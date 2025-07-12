-- Create enum types for better data integrity
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE public.user_role AS ENUM ('user', 'admin');
CREATE TYPE public.vote_type AS ENUM ('upvote', 'downvote');
CREATE TYPE public.notification_type AS ENUM ('mention', 'answer', 'accepted');

-- Create users table (profiles)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  gender gender_type,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'user',
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  downvote_count INTEGER NOT NULL DEFAULT 0,
  answer_count INTEGER NOT NULL DEFAULT 0,
  has_accepted_answer BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create answers table
CREATE TABLE public.answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  downvote_count INTEGER NOT NULL DEFAULT 0,
  is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create votes table for tracking user votes
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES public.answers(id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure user can only vote once per question or answer
  CONSTRAINT unique_question_vote UNIQUE (user_id, question_id),
  CONSTRAINT unique_answer_vote UNIQUE (user_id, answer_id),
  
  -- Ensure vote is for either question or answer, not both
  CONSTRAINT vote_target_check CHECK (
    (question_id IS NOT NULL AND answer_id IS NULL) OR 
    (question_id IS NULL AND answer_id IS NOT NULL)
  )
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES public.answers(id) ON DELETE CASCADE,
  mentioned_by UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create mentions table for tracking @username mentions
CREATE TABLE public.mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES public.answers(id) ON DELETE CASCADE,
  mentioned_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure mention is for either question or answer, not both
  CONSTRAINT mention_target_check CHECK (
    (question_id IS NOT NULL AND answer_id IS NULL) OR 
    (question_id IS NULL AND answer_id IS NOT NULL)
  )
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for questions
CREATE POLICY "Questions are viewable by everyone" 
  ON public.questions FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create questions" 
  ON public.questions FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own questions" 
  ON public.questions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Question authors and admins can delete questions" 
  ON public.questions FOR DELETE 
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for answers
CREATE POLICY "Answers are viewable by everyone" 
  ON public.answers FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create answers" 
  ON public.answers FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own answers" 
  ON public.answers FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Answer authors and admins can delete answers" 
  ON public.answers FOR DELETE 
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for votes
CREATE POLICY "Users can view all votes" 
  ON public.votes FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own votes" 
  ON public.votes FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" 
  ON public.votes FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" 
  ON public.votes FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" 
  ON public.notifications FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" 
  ON public.notifications FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policies for mentions
CREATE POLICY "Users can view mentions" 
  ON public.mentions FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can create mentions" 
  ON public.mentions FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_questions_user_id ON public.questions(user_id);
CREATE INDEX idx_questions_created_at ON public.questions(created_at DESC);
CREATE INDEX idx_questions_tags ON public.questions USING GIN(tags);
CREATE INDEX idx_answers_question_id ON public.answers(question_id);
CREATE INDEX idx_answers_user_id ON public.answers(user_id);
CREATE INDEX idx_answers_created_at ON public.answers(created_at DESC);
CREATE INDEX idx_votes_user_id ON public.votes(user_id);
CREATE INDEX idx_votes_question_id ON public.votes(question_id);
CREATE INDEX idx_votes_answer_id ON public.votes(answer_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_mentions_user_id ON public.mentions(user_id);

-- Create functions for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_answers_updated_at BEFORE UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update question answer count
CREATE OR REPLACE FUNCTION public.update_question_answer_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.questions 
    SET answer_count = answer_count + 1
    WHERE id = NEW.question_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.questions 
    SET answer_count = answer_count - 1
    WHERE id = OLD.question_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for answer count management
CREATE TRIGGER update_answer_count_on_insert
  AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_question_answer_count();

CREATE TRIGGER update_answer_count_on_delete
  AFTER DELETE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_question_answer_count();

-- Function to update vote counts
CREATE OR REPLACE FUNCTION public.update_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.question_id IS NOT NULL THEN
      IF NEW.vote_type = 'upvote' THEN
        UPDATE public.questions SET upvote_count = upvote_count + 1 WHERE id = NEW.question_id;
      ELSE
        UPDATE public.questions SET downvote_count = downvote_count + 1 WHERE id = NEW.question_id;
      END IF;
    ELSIF NEW.answer_id IS NOT NULL THEN
      IF NEW.vote_type = 'upvote' THEN
        UPDATE public.answers SET upvote_count = upvote_count + 1 WHERE id = NEW.answer_id;
      ELSE
        UPDATE public.answers SET downvote_count = downvote_count + 1 WHERE id = NEW.answer_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.question_id IS NOT NULL THEN
      IF OLD.vote_type = 'upvote' THEN
        UPDATE public.questions SET upvote_count = upvote_count - 1 WHERE id = OLD.question_id;
      ELSE
        UPDATE public.questions SET downvote_count = downvote_count - 1 WHERE id = OLD.question_id;
      END IF;
    ELSIF OLD.answer_id IS NOT NULL THEN
      IF OLD.vote_type = 'upvote' THEN
        UPDATE public.answers SET upvote_count = upvote_count - 1 WHERE id = OLD.answer_id;
      ELSE
        UPDATE public.answers SET downvote_count = downvote_count - 1 WHERE id = OLD.answer_id;
      END IF;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle vote type changes
    IF OLD.question_id IS NOT NULL THEN
      IF OLD.vote_type = 'upvote' THEN
        UPDATE public.questions SET upvote_count = upvote_count - 1 WHERE id = OLD.question_id;
      ELSE
        UPDATE public.questions SET downvote_count = downvote_count - 1 WHERE id = OLD.question_id;
      END IF;
      IF NEW.vote_type = 'upvote' THEN
        UPDATE public.questions SET upvote_count = upvote_count + 1 WHERE id = NEW.question_id;
      ELSE
        UPDATE public.questions SET downvote_count = downvote_count + 1 WHERE id = NEW.question_id;
      END IF;
    ELSIF OLD.answer_id IS NOT NULL THEN
      IF OLD.vote_type = 'upvote' THEN
        UPDATE public.answers SET upvote_count = upvote_count - 1 WHERE id = OLD.answer_id;
      ELSE
        UPDATE public.answers SET downvote_count = downvote_count - 1 WHERE id = OLD.answer_id;
      END IF;
      IF NEW.vote_type = 'upvote' THEN
        UPDATE public.answers SET upvote_count = upvote_count + 1 WHERE id = NEW.answer_id;
      ELSE
        UPDATE public.answers SET downvote_count = downvote_count + 1 WHERE id = NEW.answer_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for vote count management
CREATE TRIGGER update_vote_counts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.update_vote_counts();

-- Function to handle accepted answers
CREATE OR REPLACE FUNCTION public.update_question_accepted_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_accepted != NEW.is_accepted THEN
    IF NEW.is_accepted = true THEN
      -- Unmark other answers as accepted for this question
      UPDATE public.answers 
      SET is_accepted = false 
      WHERE question_id = NEW.question_id AND id != NEW.id;
      
      -- Mark question as having accepted answer
      UPDATE public.questions 
      SET has_accepted_answer = true 
      WHERE id = NEW.question_id;
    ELSE
      -- Check if any other answers are accepted for this question
      IF NOT EXISTS (
        SELECT 1 FROM public.answers 
        WHERE question_id = NEW.question_id AND is_accepted = true AND id != NEW.id
      ) THEN
        UPDATE public.questions 
        SET has_accepted_answer = false 
        WHERE id = NEW.question_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for accepted answer management
CREATE TRIGGER update_accepted_answer_trigger
  AFTER UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_question_accepted_status();