// Note: fs operations are only available server-side

export interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  slug: string;
  thumbnail: string;
  authorId?: string;
  authorIds?: string[];
  content: string;
}

export interface BlogPostMetadata {
  title: string;
  excerpt: string;
  date: string;
  category: string;
  slug: string;
  thumbnail: string;
  authorId?: string;
  authorIds?: string[];
}

/**
 * Parse frontmatter from MDX content
 */
function parseFrontmatter(content: string): { metadata: BlogPostMetadata; content: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!frontmatterMatch) {
    throw new Error('No frontmatter found in MDX file');
  }

  const [, frontmatterStr, markdownContent] = frontmatterMatch;
  const metadata: any = {};

  // Parse YAML-like frontmatter
  frontmatterStr.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Remove quotes
      value = value.replace(/^["']|["']$/g, '');
      
      // Handle arrays (for authorIds)
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.slice(1, -1);
        if (arrayContent) {
          metadata[key] = arrayContent.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
          return; // Skip the normal assignment below
        } else {
          metadata[key] = [];
          return; // Skip the normal assignment below
        }
      }
      
      metadata[key] = value;
    }
  });

  return {
    metadata: metadata as BlogPostMetadata,
    content: markdownContent.trim()
  };
}

/**
 * Get all blog posts from the filesystem (server-side only)
 */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  try {
    // Server-side only - not available in browser
    if (typeof window !== 'undefined') {
      throw new Error('getAllBlogPosts is only available server-side');
    }

    // Dynamic import to avoid loading fs in browser
    const { readFileSync, readdirSync } = await import('fs');
    const { join } = await import('path');

    const postsDirectory = join(process.cwd(), 'apps/mail/blog/posts');
    const filenames = readdirSync(postsDirectory).filter(name => name.endsWith('.mdx'));

    const posts = filenames.map((filename, index) => {
      const filePath = join(postsDirectory, filename);
      const fileContent = readFileSync(filePath, 'utf-8');
      const { metadata, content } = parseFrontmatter(fileContent);

      return {
        id: index + 1,
        ...metadata,
        content,
        authorIds: metadata.authorIds || undefined,
      };
    });

    // Sort by date (newest first)
    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error reading blog posts:', error);
    return [];
  }
}

/**
 * Get a single blog post by slug (server-side only)
 */
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    // Server-side only
    if (typeof window !== 'undefined') {
      throw new Error('getBlogPostBySlug is only available server-side');
    }

    // Dynamic import to avoid loading fs in browser
    const { readFileSync } = await import('fs');
    const { join } = await import('path');

    const filePath = join(process.cwd(), 'apps/mail/blog/posts', `${slug}.mdx`);
    const fileContent = readFileSync(filePath, 'utf-8');
    const { metadata, content } = parseFrontmatter(fileContent);

    return {
      id: 1,
      ...metadata,
      content,
    } as BlogPost;
  } catch (error) {
    console.error(`Error reading blog post ${slug}:`, error);
    return null;
  }
}

/**
 * Client-side utility to fetch and parse blog post
 */
export async function fetchBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const response = await fetch(`/blog/posts/${slug}.mdx`);
    if (!response.ok) {
      return null;
    }
    
    const content = await response.text();
    const { metadata, content: markdownContent } = parseFrontmatter(content);
    
    return {
      id: 1,
      ...metadata,
      content: markdownContent,
    } as BlogPost;
  } catch (error) {
    console.error(`Error fetching blog post ${slug}:`, error);
    return null;
  }
}

/**
 * Client-side utility to fetch all blog posts metadata
 */
export async function fetchAllBlogPosts(): Promise<BlogPost[]> {
  try {
    // For now, we'll hardcode the known blog posts
    // In a real app, you might have an API endpoint that lists all available posts
    const knownSlugs = [
      'a-faster-zero',
      'zero-modernized-email',
      'rebranding-zero-email',
      // Add more as you create them
    ];

    const posts = await Promise.all(
      knownSlugs.map(async (slug, index) => {
        try {
          const response = await fetch(`/blog/posts/${slug}.mdx`);
          if (!response.ok) return null;
          
          const content = await response.text();
          const { metadata } = parseFrontmatter(content);
          
          return {
            id: index + 1,
            ...metadata,
            content: '', // Don't include full content in listing
          } as BlogPost;
        } catch {
          return null;
        }
      })
    );

    const filteredPosts = posts.filter((post): post is BlogPost => post !== null);
    return filteredPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
} 