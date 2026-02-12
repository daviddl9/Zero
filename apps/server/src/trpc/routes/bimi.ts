import { router, privateProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getCachedBimi, setCachedBimi, type BimiCacheEntry } from '../../lib/bimi-cache';

const parseBimiRecord = (record: string) => {
  const parts = record.split(';').map((part) => part.trim());
  const result: { version?: string; logoUrl?: string; authorityUrl?: string } = {};

  for (const part of parts) {
    if (part.startsWith('v=')) {
      result.version = part.substring(2);
    } else if (part.startsWith('l=')) {
      result.logoUrl = part.substring(2);
    } else if (part.startsWith('a=')) {
      result.authorityUrl = part.substring(2);
    }
  }

  return result;
};

const fetchDnsRecord = async (domain: string): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=default._bimi.${domain}&type=TXT`,
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      Status: number;
      Answer?: Array<{ data: string }>;
    };

    if (data.Status !== 0 || !data.Answer || data.Answer.length === 0) {
      return null;
    }

    const bimiRecord = data.Answer.find((answer) => answer.data.includes('v=BIMI1'));

    if (!bimiRecord) {
      return null;
    }

    return bimiRecord.data.replace(/"/g, '');
  } catch (error) {
    console.error(`Error fetching BIMI record for ${domain}:`, error);
    return null;
  }
};

const fetchLogoContent = async (logoUrl: string): Promise<string | null> => {
  try {
    const url = new URL(logoUrl);
    if (url.protocol !== 'https:') {
      return null;
    }

    const response = await fetch(logoUrl, {
      headers: {
        Accept: 'image/svg+xml',
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('svg')) {
      return null;
    }

    const svgContent = await response.text();

    if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
      return null;
    }

    return svgContent;
  } catch (error) {
    console.error(`Error fetching logo from ${logoUrl}:`, error);
    return null;
  }
};

/**
 * Fetch BIMI data for a domain (DNS lookup + SVG fetch).
 * Shared logic used by all BIMI endpoints.
 */
async function fetchBimiForDomain(domain: string): Promise<BimiCacheEntry> {
  const bimiRecordText = await fetchDnsRecord(domain);

  if (!bimiRecordText) {
    return { domain, bimiRecord: null, logo: null };
  }

  const bimiRecord = parseBimiRecord(bimiRecordText);

  let logo: BimiCacheEntry['logo'] = null;
  if (bimiRecord.logoUrl) {
    const svgContent = await fetchLogoContent(bimiRecord.logoUrl);
    if (svgContent) {
      logo = { url: bimiRecord.logoUrl, svgContent };
    }
  }

  return { domain, bimiRecord, logo };
}

/**
 * Get BIMI data for a domain, checking cache first.
 */
async function getBimiWithCache(domain: string): Promise<BimiCacheEntry> {
  const cached = await getCachedBimi(domain);
  if (cached) return cached;

  const result = await fetchBimiForDomain(domain);
  setCachedBimi(domain, result);
  return result;
}

const bimiOutputSchema = z.object({
  domain: z.string(),
  bimiRecord: z
    .object({
      version: z.string().optional(),
      logoUrl: z.string().optional(),
      authorityUrl: z.string().optional(),
    })
    .nullable(),
  logo: z
    .object({
      url: z.string(),
      svgContent: z.string(),
    })
    .nullable(),
});

export const bimiRouter = router({
  getByEmail: privateProcedure
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .output(bimiOutputSchema)
    .query(async ({ input }) => {
      const domain = input.email.split('@')[1];

      if (!domain) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Unable to extract domain from email address',
        });
      }

      return getBimiWithCache(domain);
    }),

  getByDomain: privateProcedure
    .input(
      z.object({
        domain: z.string().min(1),
      }),
    )
    .output(bimiOutputSchema)
    .query(async ({ input }) => {
      return getBimiWithCache(input.domain);
    }),

  getByDomains: privateProcedure
    .input(
      z.object({
        domains: z.array(z.string().min(1)).min(1).max(50),
      }),
    )
    .output(z.array(bimiOutputSchema))
    .query(async ({ input }) => {
      const results = await Promise.all(
        input.domains.map((domain) => getBimiWithCache(domain)),
      );
      return results;
    }),
});
