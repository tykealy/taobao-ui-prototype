import { NextRequest, NextResponse } from 'next/server';
import { extractProductId, extractUrlFromText } from '@/lib/extract-product-id';

/**
 * Attempt to fetch URL with retry logic
 * Tries HEAD request first, falls back to GET if HEAD fails
 */
async function fetchWithRetry(url: string): Promise<Response> {
  const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
  
  // Attempt 1: HEAD request with mobile User-Agent
  try {
    const headResponse = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (headResponse.ok || headResponse.redirected) {
      return headResponse;
    }
  } catch (error) {
    console.log('HEAD request failed, trying GET:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Attempt 2: GET request with mobile User-Agent (fallback)
  try {
    const getResponse = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    return getResponse;
  } catch (error) {
    throw new Error(`Failed to fetch URL after retry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * API endpoint to resolve shortened Taobao URLs
 * Follows redirects to get the final URL and extract product ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get('url');

    if (!rawUrl) {
      return NextResponse.json(
        {
          success: false,
          message: 'URL parameter is required',
          data: null,
        },
        { status: 400 }
      );
    }

    // Extract URL from text (handles cases where user pastes share text with URL)
    const url = extractUrlFromText(rawUrl);

    // Validate that it's a Taobao/Tmall URL
    if (!/taobao\.com|tmall\.com/i.test(url)) {
      return NextResponse.json(
        {
          success: false,
          message: 'URL must be a Taobao or Tmall link',
          data: null,
        },
        { status: 400 }
      );
    }

    // Follow redirects to get the final URL with retry logic
    let response: Response;
    try {
      response = await fetchWithRetry(url);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: 'Could not resolve the shortened link. Please try opening it in the Taobao app first, then copy the full URL.',
          data: { originalUrl: url, error: error instanceof Error ? error.message : 'Network error' },
        },
        { status: 500 }
      );
    }

    const finalUrl = response.url;

    // Try to extract product ID using the enhanced extraction function
    let productId = extractProductId(finalUrl);

    // If extraction failed from final URL, log for debugging
    if (!productId) {
      console.error('Failed to extract product ID from final URL:', finalUrl);
      
      return NextResponse.json(
        {
          success: false,
          message: 'Could not extract product ID from the resolved URL. Please try opening the link in the Taobao app and copying the full product URL.',
          data: { 
            finalUrl,
            hint: 'The URL may use an unsupported format. Look for ?id= or ?targetId= in the URL.'
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'URL resolved successfully',
      data: {
        productId,
        finalUrl,
      },
    });
  } catch (error) {
    console.error('Error resolving URL:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred while resolving the URL. Please try again.',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}
