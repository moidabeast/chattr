import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Send, Image as ImageIcon, Video, X } from 'lucide-react';
import { SiX } from 'react-icons/si';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';

interface MessageInputProps {
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string) => void;
  disabled?: boolean;
  isSending?: boolean;
}

export default function MessageInput({ onSendMessage, disabled, isSending }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [mediaTab, setMediaTab] = useState<'image' | 'video' | 'twitter'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectVideoType = (url: string): 'youtube' | 'twitch' | null => {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      return 'youtube';
    }
    
    if (lowerUrl.includes('twitch.tv') || lowerUrl.includes('clips.twitch.tv')) {
      return 'twitch';
    }
    
    return null;
  };

  const validateVideoUrl = (url: string): { isValid: boolean; type: 'youtube' | 'twitch' | null } => {
    if (!url.trim()) {
      setMediaError('URL is required');
      return { isValid: false, type: null };
    }

    const videoType = detectVideoType(url);
    
    if (!videoType) {
      setMediaError('Invalid video URL. Must be a YouTube or Twitch URL');
      return { isValid: false, type: null };
    }

    setMediaError('');
    return { isValid: true, type: videoType };
  };

  const validateTwitterUrl = (url: string): boolean => {
    if (!url.trim()) {
      setMediaError('URL is required');
      return false;
    }

    const lowerUrl = url.toLowerCase();
    const isTwitter = lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com');
    
    if (!isTwitter) {
      setMediaError('Invalid Twitter/X URL');
      return false;
    }

    setMediaError('');
    return true;
  };

  const validateImageFile = (file: File): boolean => {
    if (!file.type.startsWith('image/')) {
      setMediaError('Invalid file type. Must be an image file');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMediaError('File size must be less than 10MB');
      return false;
    }

    setMediaError('');
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateImageFile(file)) {
        setSelectedFile(file);
        setMediaError('');
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleVideoUrlChange = (value: string) => {
    setVideoUrl(value);
    if (value.trim()) {
      if (mediaTab === 'video') {
        validateVideoUrl(value);
      } else if (mediaTab === 'twitter') {
        validateTwitterUrl(value);
      }
    } else {
      setMediaError('');
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      setIsUploading(true);
      setUploadProgress(10);
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      setUploadProgress(50);
      
      const imageId = `blob-storage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const storageKey = `image_${imageId}`;
      
      try {
        localStorage.setItem(storageKey, dataUrl);
      } catch (e) {
        console.warn('[MessageInput] localStorage full, using data URL directly');
      }
      
      setUploadProgress(100);
      
      const blobStorageUrl = `data:${file.type};blob-storage-id=${imageId};base64,${dataUrl.split(',')[1]}`;
      
      return blobStorageUrl;
    } catch (error) {
      console.error('[MessageInput] Error processing image:', error);
      throw error instanceof Error ? error : new Error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (disabled || isUploading || isSending) return;

    if (showMediaInput) {
      if (mediaTab === 'image' && selectedFile) {
        if (!validateImageFile(selectedFile)) return;
        
        try {
          const mediaUrl = await uploadImage(selectedFile);
          const content = message.trim() || 'Image';
          onSendMessage(content, mediaUrl, 'image');
          
          setMessage('');
          setSelectedFile(null);
          setShowMediaInput(false);
          setMediaError('');
          setUploadProgress(0);
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (error) {
          setMediaError(error instanceof Error ? error.message : 'Failed to upload image');
        }
        return;
      } else if (mediaTab === 'video' && videoUrl.trim()) {
        const validation = validateVideoUrl(videoUrl);
        if (!validation.isValid || !validation.type) return;
        
        const content = message.trim() || `${validation.type === 'youtube' ? 'YouTube' : 'Twitch'} Video`;
        onSendMessage(content, videoUrl.trim(), validation.type);
        
        setMessage('');
        setVideoUrl('');
        setShowMediaInput(false);
        setMediaError('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      } else if (mediaTab === 'twitter' && videoUrl.trim()) {
        if (!validateTwitterUrl(videoUrl)) return;
        
        const content = message.trim() || 'Twitter Post';
        onSendMessage(content, videoUrl.trim(), 'twitter');
        
        setMessage('');
        setVideoUrl('');
        setShowMediaInput(false);
        setMediaError('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      } else {
        setMediaError('Please select media or enter a URL');
        return;
      }
    }

    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleCancelMedia = () => {
    setShowMediaInput(false);
    setSelectedFile(null);
    setVideoUrl('');
    setMediaError('');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canSend = !disabled && !isUploading && !isSending && (
    (showMediaInput && ((mediaTab === 'image' && selectedFile) || (mediaTab !== 'image' && videoUrl.trim()))) ||
    (!showMediaInput && message.trim())
  );

  return (
    <div className="space-y-2">
      {showMediaInput && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-sm font-medium">Add Media</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelMedia}
              disabled={isUploading || isSending}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <Tabs value={mediaTab} onValueChange={(v) => setMediaTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="image" disabled={isUploading || isSending}>
                <ImageIcon className="mr-1 h-3 w-3" />
                Image
              </TabsTrigger>
              <TabsTrigger value="video" disabled={isUploading || isSending}>
                <Video className="mr-1 h-3 w-3" />
                Video
              </TabsTrigger>
              <TabsTrigger value="twitter" disabled={isUploading || isSending}>
                <SiX className="mr-1 h-3 w-3" />
                Twitter
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="image" className="space-y-2 mt-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploading || isSending}
                className="text-sm"
              />
              {selectedFile && (
                <p className="text-xs text-primary">
                  Selected: {selectedFile.name}
                </p>
              )}
              {isUploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {Math.round(uploadProgress)}%
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="video" className="space-y-2 mt-3">
              <Input
                value={videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                placeholder="YouTube or Twitch URL"
                type="url"
                disabled={isUploading || isSending}
                className="text-sm"
                style={{ fontSize: '16px' }}
              />
              <p className="text-xs text-muted-foreground">
                Paste a YouTube or Twitch video URL - automatically detected
              </p>
            </TabsContent>

            <TabsContent value="twitter" className="space-y-2 mt-3">
              <Input
                value={videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                placeholder="https://twitter.com/user/status/..."
                type="url"
                disabled={isUploading || isSending}
                className="text-sm"
                style={{ fontSize: '16px' }}
              />
              <p className="text-xs text-muted-foreground">
                Paste a Twitter/X post URL
              </p>
            </TabsContent>
          </Tabs>
          
          {mediaError && (
            <p className="mt-2 text-xs text-destructive">{mediaError}</p>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        {!showMediaInput && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowMediaInput(true)}
            disabled={disabled || isSending}
            className="h-11 w-11 flex-shrink-0 rounded-full"
            title="Add media"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
        )}
        
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={showMediaInput ? "Add a caption (optional)..." : "Type a message..."}
          disabled={disabled || isUploading || isSending}
          className="min-h-[44px] max-h-[120px] resize-none rounded-full px-4 py-3 focus-visible:ring-1"
          style={{ fontSize: '16px' }}
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className="h-11 w-11 flex-shrink-0 rounded-full"
        >
          {isUploading || isSending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
