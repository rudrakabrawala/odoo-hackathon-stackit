import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChevronUp, ChevronDown, MessageSquare, Clock, CheckCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface Question {
  id: string;
  title: string;
  description: string;
  tags: string[];
  user_id: string;
  upvote_count: number;
  downvote_count: number;
  answer_count: number;
  has_accepted_answer: boolean;
  created_at: string;
  profiles: {
    username: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface UserVote {
  vote_type: 'upvote' | 'downvote';
}

interface QuestionCardProps {
  question: Question;
  userVote?: UserVote;
  onVoteChange?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
}

export function QuestionCard({ question, userVote, onVoteChange, onDelete, onClick }: QuestionCardProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [voting, setVoting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAuthor = user?.id === question.user_id;
  const isAdmin = profile?.role === 'admin';
  const canDelete = isAuthor || isAdmin;

  const handleVote = async (e: React.MouseEvent, voteType: 'upvote' | 'downvote') => {
    e.stopPropagation(); // Prevent card click when voting
    if (!user || voting) return;

    setVoting(true);
    try {
      if (userVote?.vote_type === voteType) {
        // Remove vote
        const { error } = await supabase
          .from('votes')
          .delete()
          .eq('user_id', user.id)
          .eq('question_id', question.id);

        if (error) throw error;
      } else {
        // Add or update vote
        const { error } = await supabase
          .from('votes')
          .upsert({
            user_id: user.id,
            question_id: question.id,
            vote_type: voteType,
          });

        if (error) throw error;
      }

      onVoteChange?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update vote",
        variant: "destructive",
      });
    } finally {
      setVoting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when deleting
    if (!canDelete || deleting) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', question.id);

      if (error) throw error;

      toast({
        title: "Question deleted",
        description: "The question has been successfully deleted.",
      });

      onDelete?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete question",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const voteScore = question.upvote_count - question.downvote_count;

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 bg-gradient-card cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold hover:text-primary transition-colors">
              {question.title}
            </h3>
            <p className="text-muted-foreground mt-2 line-clamp-3">
              {question.description}
            </p>
          </div>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {question.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {question.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Vote Section */}
            <div className="flex items-center space-x-1">
              <Button
                variant="vote"
                size="icon-sm"
                onClick={(e) => handleVote(e, 'upvote')}
                disabled={!user || voting}
                className={userVote?.vote_type === 'upvote' ? 'text-success bg-success/10' : ''}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <span className={`text-sm font-medium min-w-[2rem] text-center ${
                voteScore > 0 ? 'text-success' : voteScore < 0 ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {voteScore}
              </span>
              <Button
                variant="vote"
                size="icon-sm"
                onClick={(e) => handleVote(e, 'downvote')}
                disabled={!user || voting}
                className={userVote?.vote_type === 'downvote' ? 'text-destructive bg-destructive/10' : ''}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            {/* Answer count */}
            <div className="flex items-center space-x-1">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {question.answer_count}
              </span>
              {question.has_accepted_answer && (
                <CheckCircle className="w-4 h-4 text-success" />
              )}
            </div>

            {/* Time */}
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Author */}
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={question.profiles.avatar_url} />
              <AvatarFallback className="text-xs bg-gradient-primary text-primary-foreground">
                {getInitials(question.profiles.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              @{question.profiles.username}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}