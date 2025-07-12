import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/hooks/useProfile';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ChevronUp, ChevronDown, MessageSquare, Clock, CheckCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Question {
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

interface Answer {
  id: string;
  content: string;
  user_id: string;
  upvote_count: number;
  downvote_count: number;
  is_accepted: boolean;
  created_at: string;
  profiles: {
    username: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface UserVote {
  vote_type: 'upvote' | 'downvote';
}

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questionVote, setQuestionVote] = useState<UserVote | null>(null);
  const [answerVotes, setAnswerVotes] = useState<{ [key: string]: UserVote }>({});
  const [loading, setLoading] = useState(true);
  const [newAnswer, setNewAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchQuestion();
      fetchAnswers();
      if (user) {
        fetchVotes();
      }
    }
  }, [id, user]);

  const fetchQuestion = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          profiles!questions_user_id_fkey (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setQuestion(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch question",
        variant: "destructive",
      });
      navigate('/');
    }
  };

  const fetchAnswers = async () => {
    try {
      const { data, error } = await supabase
        .from('answers')
        .select(`
          *,
          profiles!answers_user_id_fkey (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('question_id', id)
        .order('is_accepted', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAnswers(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch answers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchVotes = async () => {
    if (!user) return;

    try {
      // Fetch question vote
      const { data: questionVoteData } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('user_id', user.id)
        .eq('question_id', id)
        .maybeSingle();

      if (questionVoteData) {
        setQuestionVote({ vote_type: questionVoteData.vote_type });
      }

      // Fetch answer votes
      const answerIds = answers.map(a => a.id);
      if (answerIds.length > 0) {
        const { data: answerVotesData } = await supabase
          .from('votes')
          .select('answer_id, vote_type')
          .eq('user_id', user.id)
          .in('answer_id', answerIds);

        if (answerVotesData) {
          const votesMap = answerVotesData.reduce((acc, vote) => {
            if (vote.answer_id) {
              acc[vote.answer_id] = { vote_type: vote.vote_type };
            }
            return acc;
          }, {} as { [key: string]: UserVote });
          setAnswerVotes(votesMap);
        }
      }
    } catch (error) {
      console.error('Failed to fetch votes:', error);
    }
  };

  const handleVote = async (type: 'upvote' | 'downvote', answerId?: string) => {
    if (!user) return;

    try {
      const currentVote = answerId ? answerVotes[answerId] : questionVote;
      const isRemoving = currentVote?.vote_type === type;

      if (isRemoving) {
        // Remove vote
        const { error } = await supabase
          .from('votes')
          .delete()
          .eq('user_id', user.id)
          .eq(answerId ? 'answer_id' : 'question_id', answerId || id);

        if (error) throw error;
      } else {
        // Add or update vote
        const { error } = await supabase
          .from('votes')
          .upsert({
            user_id: user.id,
            question_id: answerId ? null : id,
            answer_id: answerId || null,
            vote_type: type,
          });

        if (error) throw error;
      }

      // Refresh data
      await fetchQuestion();
      await fetchAnswers();
      await fetchVotes();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update vote",
        variant: "destructive",
      });
    }
  };

  const handleSubmitAnswer = async () => {
    if (!user || !newAnswer.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('answers')
        .insert({
          content: newAnswer.trim(),
          question_id: id!,
          user_id: user.id,
        });

      if (error) throw error;

      setNewAnswer('');
      toast({
        title: "Answer posted",
        description: "Your answer has been posted successfully.",
      });
      
      await fetchAnswers();
      await fetchQuestion();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post answer",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptAnswer = async (answerId: string) => {
    if (!user || !question || question.user_id !== user.id) return;

    try {
      const { error } = await supabase
        .from('answers')
        .update({ is_accepted: true })
        .eq('id', answerId);

      if (error) throw error;

      toast({
        title: "Answer accepted",
        description: "The answer has been marked as accepted.",
      });

      await fetchAnswers();
      await fetchQuestion();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to accept answer",
        variant: "destructive",
      });
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

  if (loading || !question) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading question...</p>
          </div>
        </div>
      </div>
    );
  }

  const questionVoteScore = question.upvote_count - question.downvote_count;
  const isQuestionAuthor = user?.id === question.user_id;
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Question */}
        <div className="bg-gradient-card rounded-xl p-6 mb-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-4 text-foreground">
            {question.title}
          </h1>
          
          <p className="text-muted-foreground mb-4 leading-relaxed">
            {question.description}
          </p>
          
          {question.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {question.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Vote Section */}
              <div className="flex items-center space-x-1">
                <Button
                  variant="vote"
                  size="icon-sm"
                  onClick={() => handleVote('upvote')}
                  disabled={!user}
                  className={questionVote?.vote_type === 'upvote' ? 'text-success bg-success/10' : ''}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <span className={`text-sm font-medium min-w-[2rem] text-center ${
                  questionVoteScore > 0 ? 'text-success' : questionVoteScore < 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {questionVoteScore}
                </span>
                <Button
                  variant="vote"
                  size="icon-sm"
                  onClick={() => handleVote('downvote')}
                  disabled={!user}
                  className={questionVote?.vote_type === 'downvote' ? 'text-destructive bg-destructive/10' : ''}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center space-x-1">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {question.answer_count} {question.answer_count === 1 ? 'answer' : 'answers'}
                </span>
                {question.has_accepted_answer && (
                  <CheckCircle className="w-4 h-4 text-success" />
                )}
              </div>

              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
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
        </div>

        {/* Answers */}
        <div className="space-y-4 mb-6">
          <h2 className="text-xl font-semibold">
            {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
          </h2>
          
          {answers.map((answer) => {
            const answerVoteScore = answer.upvote_count - answer.downvote_count;
            const userVote = answerVotes[answer.id];
            
            return (
              <div key={answer.id} className={`bg-gradient-card rounded-xl p-6 shadow-lg ${
                answer.is_accepted ? 'ring-2 ring-success/50' : ''
              }`}>
                {answer.is_accepted && (
                  <div className="flex items-center space-x-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="text-sm font-medium text-success">Accepted Answer</span>
                  </div>
                )}
                
                <p className="text-foreground mb-4 leading-relaxed">
                  {answer.content}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Vote Section */}
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="vote"
                        size="icon-sm"
                        onClick={() => handleVote('upvote', answer.id)}
                        disabled={!user}
                        className={userVote?.vote_type === 'upvote' ? 'text-success bg-success/10' : ''}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <span className={`text-sm font-medium min-w-[2rem] text-center ${
                        answerVoteScore > 0 ? 'text-success' : answerVoteScore < 0 ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        {answerVoteScore}
                      </span>
                      <Button
                        variant="vote"
                        size="icon-sm"
                        onClick={() => handleVote('downvote', answer.id)}
                        disabled={!user}
                        className={userVote?.vote_type === 'downvote' ? 'text-destructive bg-destructive/10' : ''}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>

                    {isQuestionAuthor && !answer.is_accepted && !question.has_accepted_answer && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleAcceptAnswer(answer.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Accept
                      </Button>
                    )}

                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={answer.profiles.avatar_url} />
                      <AvatarFallback className="text-xs bg-gradient-primary text-primary-foreground">
                        {getInitials(answer.profiles.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      @{answer.profiles.username}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Answer Form */}
        {user && (
          <div className="bg-gradient-card rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Your Answer</h3>
            <Textarea
              placeholder="Write your answer here..."
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              className="mb-4 min-h-[120px]"
            />
            <Button
              onClick={handleSubmitAnswer}
              disabled={!newAnswer.trim() || submitting}
              variant="hero"
            >
              {submitting ? "Posting..." : "Post Answer"}
            </Button>
          </div>
        )}

        {!user && (
          <div className="bg-gradient-card rounded-xl p-6 shadow-lg text-center">
            <p className="text-muted-foreground mb-4">
              Please sign in to post an answer.
            </p>
            <Button onClick={() => navigate('/auth')} variant="hero">
              Sign In
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}