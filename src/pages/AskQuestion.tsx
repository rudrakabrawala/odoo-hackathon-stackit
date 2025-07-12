import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { X, Plus } from 'lucide-react';

export default function AskQuestion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: [] as string[],
  });
  const [currentTag, setCurrentTag] = useState('');

  // Redirect if not authenticated
  if (!user) {
    navigate('/auth');
    return null;
  }

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim()) && formData.tags.length < 5) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim().toLowerCase()]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both title and description.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .insert([
          {
            title: formData.title.trim(),
            description: formData.description.trim(),
            tags: formData.tags,
            user_id: user.id,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Question Posted!",
        description: "Your question has been successfully posted.",
      });

      navigate(`/questions/${data.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post question. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-xl bg-gradient-card">
          <CardHeader>
            <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
              Ask a Question
            </CardTitle>
            <p className="text-muted-foreground">
              Get help from our community of developers and experts
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Question Title *</Label>
                <Input
                  id="title"
                  placeholder="What's your programming question? Be specific."
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  maxLength={255}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {formData.title.length}/255 characters
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Describe your question *</Label>
                <Textarea
                  id="description"
                  placeholder="Provide more details about your question. Include what you've tried, what you expected to happen, and what actually happened."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Be clear and specific. Include code examples if relevant.
                </p>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (optional)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    placeholder="Add tags (e.g., javascript, react, css)"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={formData.tags.length >= 5}
                    maxLength={20}
                  />
                  <Button
                    type="button"
                    onClick={addTag}
                    variant="outline"
                    size="icon"
                    disabled={!currentTag.trim() || formData.tags.includes(currentTag.trim()) || formData.tags.length >= 5}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add up to 5 tags to help categorize your question. Press Enter or click + to add.
                </p>
              </div>

              {/* Guidelines */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">Writing Guidelines</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Be specific and clear in your question title</li>
                  <li>• Provide context and what you've already tried</li>
                  <li>• Include relevant code snippets or error messages</li>
                  <li>• Use proper tags to help others find your question</li>
                  <li>• Be respectful and follow community guidelines</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  variant="hero"
                  disabled={loading || !formData.title.trim() || !formData.description.trim()}
                  className="flex-1"
                >
                  {loading ? "Posting..." : "Post Question"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}