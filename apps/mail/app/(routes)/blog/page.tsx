
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowRight, User } from 'lucide-react';
import { Link } from 'react-router';


import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { getEmployeeById } from '@/data/employees';
import { EmployeeHoverCard } from '@/components/ui/employee-hover-card';
import { fetchAllBlogPosts, type BlogPost } from '@/lib/mdx-utils';

export default function BlogPage() {
  const { setTheme } = useTheme();
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  useEffect(() => {
    const loadBlogPosts = async () => {
      try {
        const posts = await fetchAllBlogPosts();
        setBlogPosts(posts);
      } catch (error) {
        console.error('Failed to load blog posts:', error);
        // Fallback to empty array - you could show an error message here
        setBlogPosts([]);
      } finally {
        setLoading(false);
      }
    };

    loadBlogPosts();
  }, []);

  return (
    <main className="relative flex flex-col overflow-x-hidden bg-black flex-1">
      <section className="mt-2 flex flex-col items-center flex-1">
        <div className="w-full max-w-[1200px] mx-auto flex flex-col">

          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-8">
              <h1 className="text-6xl font-normal text-white text-center mb-4 mt-20">
                Blog
              </h1>
            </div>
          </div>

          {/* Blog Grid */}
          <div className="mb-16 ">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-white/60">Loading blog posts...</div>
              </div>
            ) : blogPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-white/60 mb-4">No blog posts found.</div>
                <div className="text-white/40 text-sm">Check back soon for new content!</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {blogPosts.map((post, index) => {
                const author = post.authorId ? getEmployeeById(post.authorId) : null;
                const authors = post.authorIds ? post.authorIds.map(id => getEmployeeById(id)).filter((emp): emp is NonNullable<typeof emp> => emp !== undefined) : [];
                const isMultiAuthor = authors.length > 0;
                
                return (
                  <article
                    key={post.id}
                    className="relative bg-black rounded-xl cursor-pointer"
                  >
                    {/* Large Thumbnail */}
                    <div className="aspect-[4/4] relative overflow-hidden bg-white/5 rounded-lg cursor-pointer mb-3">
                      <img
                        src={post.thumbnail}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="pb-4 cursor-pointer">
                      {/* Title */}
                      <h3 className="text-xl font-medium text-white leading-tight mb-3">
                        {post.title}
                      </h3>
                      
                      {/* Author & Date */}
                      <div className="flex items-center gap-2">
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
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-white/10 cursor-pointer relative z-20">
                              <img
                                src={author.profileImage}
                                alt={author.fullName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </EmployeeHoverCard>
                        ) : (
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-white/10">
                            <img
                              src="/adam.jpg"
                              alt="Author"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <span className="text-white/50">•</span>
                        <time className="text-sm text-white/50">
                          {post.date}
                        </time>
                      </div>
                    </div>

                    {/* Read more link */}
                    <Link
                      to={`/blog/${post.slug}`}
                      className="absolute inset-0 z-10"
                      aria-label={`Read more about ${post.title}`}
                    />
                  </article>
                );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
} 