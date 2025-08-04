import { useLoaderData } from 'react-router';
import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { getEmployeeById } from '@/data/employees';
import { EmployeeHoverCard } from '@/components/ui/employee-hover-card';
import { fetchBlogPost, type BlogPost } from '@/lib/mdx-utils';
import type { Route } from './+types/page';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response('Not Found', { status: 404 });
  }
  
  try {
    const blogPost = await fetchBlogPost(slug);
    if (!blogPost) {
      throw new Response('Not Found', { status: 404 });
    }
    return { post: blogPost };
  } catch (error) {
    throw new Response('Not Found', { status: 404 });
  }
}

export default function BlogSlugPage() {
  const { post } = useLoaderData<typeof clientLoader>();
  const { setTheme } = useTheme();

  // Dynamic title based on post title (overrides layout default)
  useEffect(() => {
    if (post?.title) {
      document.title = `${post.title} - Zero`;
    }
  }, [post?.title]);

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  const author = post.authorId ? getEmployeeById(post.authorId) : null;
  const authors = post.authorIds ? post.authorIds.map(id => getEmployeeById(id)).filter((emp): emp is NonNullable<typeof emp> => emp !== undefined) : [];
  const isMultiAuthor = authors.length > 0;

  return (
    <main className="relative flex flex-col overflow-x-hidden bg-[#000000] px-2 flex-1">
      <article className="mt-2 flex flex-col items-center flex-1">
        <div className="w-full max-w-[800px] mx-auto flex flex-col px-5">
          
          {/* Header */}
          <header className="mb-8 mt-16 text-center">
            {/* Title */}
            <h1 className="text-4xl md:text-6xl font-medium text-white mb-6 leading-tight">
              {post.title}
            </h1>
            
            {/* Excerpt */}
            <p className="text-lg text-white/70 mb-8 leading-relaxed max-w-3xl mx-auto">
              {post.excerpt}
            </p>

            {/* Author and Date */}
            <div className="flex items-center justify-center gap-4 mb-4">
              {isMultiAuthor ? (
                <div className="flex items-center">
                  {authors.map((auth, idx) => (
                    <EmployeeHoverCard key={auth.id} employee={auth}>
                      <div 
                        className={`w-6 h-6 rounded-full overflow-hidden bg-white/10 cursor-pointer relative z-20 border-2 border-black ${idx > 0 ? '-ml-2' : ''}`}
                      >
                        <img
                          src={auth.profileImage}
                          alt={auth.fullName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </EmployeeHoverCard>
                  ))}
                </div>
              ) : author ? (
                <EmployeeHoverCard employee={author}>
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-white/10 cursor-pointer">
                    <img
                      src={author.profileImage}
                      alt={author.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </EmployeeHoverCard>
              ) : null}
              
              <div className="text-white/50 text-sm">
                •
              </div>
              
              <div className="text-white/50 text-sm">
                {post.date}
              </div>
            </div>
          </header>

          {/* Featured Image */}
          {post.thumbnail && (
            <div className="mb-12 aspect-[16/9] relative overflow-hidden bg-white/5 rounded-xl">
              <img
                src={post.thumbnail}
                alt={post.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
          )}

          {/* Content */}
          <article className="prose prose-invert prose-lg max-w-none mb-16">
            <div 
              className="text-[#a1a1aa] leading-relaxed text-lg [&>h1]:text-4xl [&>h1]:font-bold [&>h1]:text-white [&>h1]:mb-6 [&>h1]:mt-12 [&>h1]:leading-tight [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-white [&>h2]:mb-5 [&>h2]:mt-10 [&>h2]:leading-tight [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:text-white [&>h3]:mb-4 [&>h3]:mt-8 [&>h3]:leading-tight [&>p]:mb-6 [&>p]:leading-relaxed [&>p]:text-[#a1a1aa] [&>p]:text-lg [&>ul]:mb-6 [&>ul]:ml-6 [&>li]:mb-3 [&>li]:list-disc [&>li]:leading-relaxed [&>li]:text-[#a1a1aa] [&>li]:text-lg [&>strong]:text-white [&>strong]:font-semibold [&>em]:text-white/80 [&>a]:text-blue-400 [&>a]:hover:text-blue-300 [&>a]:underline [&>a]:underline-offset-2 [&>hr]:border-white/10 [&>hr]:my-12"
              dangerouslySetInnerHTML={{ 
                __html: post.content
                  .split('\n')
                  .map(line => {
                    // Headers
                    if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
                    if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
                    if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
                    
                    // Horizontal rule
                    if (line.trim() === '---') return '<hr class="border-white/10 my-8" />';
                    
                    // List items
                    if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
                    
                    // Empty lines
                    if (line.trim() === '') return '';
                    
                    // Regular paragraphs
                    return `<p>${line}</p>`;
                  })
                  .join('\n')
                  .replace(/(<li>.*<\/li>\n?)+/g, (match: string) => `<ul>${match}</ul>`)
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                  .replace(/\n+/g, '\n')
              }}
            />
          </article>

        </div>
      </article>
    </main>
  );
} 