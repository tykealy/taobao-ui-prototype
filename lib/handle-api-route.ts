import { NextRequest, NextResponse } from "next/server";

type RouteHandler = (
  req: NextRequest,
  context: { params: any; user?: any }
) => Promise<NextResponse>;

type Options = {
  requireJwt?: boolean;
};

export function handleApiKeyRoute(handler: RouteHandler, options: Options = {}) {
  return async (req: NextRequest, context: { params: any }) => {
    try {
      // 1. Check API Key (Simulated based on existing app logic)
      const apiKey = req.headers.get("X-API-Key");
      if (!apiKey) {
        return NextResponse.json(
          { success: false, message: "Missing X-API-Key header" },
          { status: 401 }
        );
      }

      // 2. Check Auth (Simplified: Just ensure header exists if required)
      let user = null;
      if (options.requireJwt) {
        const authHeader = req.headers.get("Authorization");
        /* 
           NOTE: In a real app, we would verify the JWT here.
           For this prototype, we'll assume ANY non-empty Bearer token is valid
           and derive a "customerNumber" from it or just use a default one 
           if the token is present to simulate a logged-in user.
        */
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
             // For the sake of the prototype working easily without a real auth server,
             // we might want to be lenient or strictly require it.
             // Let's require it as per code, but accept any string.
             return NextResponse.json(
               { success: false, message: "Missing or invalid Authorization header" },
               { status: 401 }
             );
        }
        
        // Mock user extraction
        const token = authHeader.split(" ")[1];
        // Use part of token as ID or fallback to a constant for consistent testing
        user = { 
            customerNumber: "test-customer-123", 
            token: token 
        };
      }

      return await handler(req, { ...context, user });
    } catch (error: any) {
      console.error("API Route Error:", error);
      return NextResponse.json(
        { success: false, message: error.message || "Internal Server Error" },
        { status: 500 }
      );
    }
  };
}
