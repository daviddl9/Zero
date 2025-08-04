import type { BlogPost } from '@/lib/mdx-utils';

export interface ClientLoaderArgs {
  params: {
    slug: string;
  };
}

export interface LoaderData {
  post: BlogPost;
}

export namespace Route {
  export type ClientLoaderArgs = {
    params: {
      slug: string;
    };
  };
} 