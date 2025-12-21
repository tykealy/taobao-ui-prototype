import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, bearerToken } = await request.json();

    if (!apiKey || !bearerToken) {
      return NextResponse.json(
        { success: false, message: 'API key and bearer token are required' },
        { status: 400 }
      );
    }

    // Ensure bearer token has "Bearer " prefix
    const token = bearerToken.trim().startsWith('Bearer ') 
      ? bearerToken.trim() 
      : `Bearer ${bearerToken.trim()}`;



    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/vtenh`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    });


    const data = await response.json();

    if (!response.ok || !data.success) {
      return NextResponse.json(
        { success: false, message: data.message || 'Authentication failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
