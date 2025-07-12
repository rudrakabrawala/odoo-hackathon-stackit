import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuestionCard, Question, UserVote } from '@/components/questions/QuestionCard';
import { Header } from '@/components/layout/Header';
import { Search, Filter, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuestionWithVote extends Question {
  userVote?: UserVote;
}

export default function Questions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<QuestionWithVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('newest');
  const [selectedTag, setSelectedTag] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const QUESTIONS_PER_PAGE = 20;

  useEffect(() => {
    fetchQuestions();
    fetchAvailableTags();
  }, [filter, selectedTag, user]);

  useEffect(() => {
    if (searchTerm) {
      const timeoutId = setTimeout(() => {
        fetchQuestions();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      fetchQuestions();
    }
  }, [searchTerm]);

  const fetchQuestions = async (pageNum = 1, append = false) => {
    try {
      setLoading(true);

      let query = supabase
        .from('questions')
        .select(`
          *,
          profiles!questions_user_id_fkey (
            username,
            full_name,
            avatar_url
          )
        `)
        .range((pageNum - 1) * QUESTIONS_PER_PAGE, pageNum * QUESTIONS_PER_PAGE - 1);

      // Apply filters
      if (filter === 'unanswered') {
        query = query.eq('answer_count', 0);
      }

      // Apply search
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      // Apply tag filter
      if (selectedTag) {
        query = query.contains('tags', [selectedTag]);
      }

      // Apply sorting
      switch (filter) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'most_voted':
          query = query.order('upvote_count', { ascending: false });
          break;
        case 'unanswered':
          query = query.order('created_at', { ascending: false });
          break;
      }

      const { data: questionsData, error } = await query;

      if (error) throw error;

      // Fetch user votes if authenticated
      let userVotes: { [key: string]: UserVote } = {};
      if (user && questionsData) {
        const questionIds = questionsData.map(q => q.id);
        const { data: votesData } = await supabase
          .from('votes')
          .select('question_id, vote_type')
          .eq('user_id', user.id)
          .in('question_id', questionIds);

        if (votesData) {
          userVotes = votesData.reduce((acc, vote) => {
            acc[vote.question_id] = { vote_type: vote.vote_type };
            return acc;
          }, {} as { [key: string]: UserVote });
        }
      }

      const questionsWithVotes = questionsData?.map(question => ({
        ...question,
        userVote: userVotes[question.id],
      })) || [];

      if (append) {
        setQuestions(prev => [...prev, ...questionsWithVotes]);
      } else {
        setQuestions(questionsWithVotes);
      }

      setHasMore(questionsData?.length === QUESTIONS_PER_PAGE);
      if (!append) setPage(pageNum);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch questions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('tags')
        .not('tags', 'is', null);

      if (error) throw error;

      const allTags = data.flatMap(q => q.tags || []);
      const uniqueTags = Array.from(new Set(allTags)).sort();
      setAvailableTags(uniqueTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchQuestions(nextPage, true);
  };

  const handleQuestionClick = (questionId: string) => {
    navigate(`/questions/${questionId}`);
  };

  const handleVoteChange = () => {
    fetchQuestions();
  };

  const handleQuestionDelete = () => {
    fetchQuestions();
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Questions
            </h1>
            <p className="text-muted-foreground mt-1">
              Explore questions from our community
            </p>
          </div>
          {user && (
            <Button 
              onClick={() => navigate('/ask')} 
              variant="hero"
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Ask Question</span>
            </Button>
          )}
        </div>

        {/* Search and Filter Section */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="most_voted">Most Voted</SelectItem>
                <SelectItem value="unanswered">Unanswered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedTag === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTag('')}
              >
                All Tags
              </Button>
              {availableTags.slice(0, 10).map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Results Count */}
        {!loading && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {questions.length} question{questions.length !== 1 ? 's' : ''} found
            </p>
          </div>
        )}

        {/* Questions List */}
        <div className="space-y-4">
          {questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              userVote={question.userVote}
              onVoteChange={handleVoteChange}
              onDelete={handleQuestionDelete}
              onClick={() => handleQuestionClick(question.id)}
            />
          ))}
        </div>

        {/* Loading State */}
        {loading && questions.length === 0 && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading questions...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && questions.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">No questions found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Try adjusting your search terms or filters."
                : "Be the first to ask a question!"
              }
            </p>
            {user && (
              <Button onClick={() => navigate('/ask')} variant="hero">
                Ask the First Question
              </Button>
            )}
          </div>
        )}

        {/* Pagination */}
        {!loading && questions.length > 0 && (
          <div className="flex justify-center mt-8">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (page > 1) {
                    const newPage = page - 1;
                    setPage(newPage);
                    fetchQuestions(newPage);
                  }
                }}
                disabled={page <= 1}
              >
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, Math.ceil(questions.length / QUESTIONS_PER_PAGE) + 2) }, (_, i) => {
                  const pageNum = Math.max(1, page - 2) + i;
                  if (pageNum > page + 2) return null;
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setPage(pageNum);
                        fetchQuestions(pageNum);
                      }}
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (hasMore) {
                    const newPage = page + 1;
                    setPage(newPage);
                    fetchQuestions(newPage);
                  }
                }}
                disabled={!hasMore}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}