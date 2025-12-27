/**
 * Step 1: Get a signed S3 URL from the backend API
 * @param fileName The file name to use for the upload
 * @param apiKey The API key for authentication
 * @param accessToken Optional access token for authorization
 * @returns Promise with the signed S3 URL and content type
 */
async function getSignedUploadUrl(
  fileName: string,
  apiKey: string,
  accessToken?: string
): Promise<{ signedUrl: string; contentType: string }> {
  const headers: HeadersInit = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  console.log('Requesting signed URL for:', fileName);

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/taobao/item-search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fileName }),
  });

  const result = await response.json();
  console.log('Signed URL response:', { 
    success: result.success, 
    hasSignedUrl: !!result.data?.signedUrl,
    contentType: result.data?.contentType 
  });

  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Failed to get upload URL');
  }

  if (!result.data?.signedUrl) {
    throw new Error('Invalid response: missing signedUrl');
  }

  console.log('Got signed URL:', result.data.signedUrl);
  console.log('Content Type:', result.data.contentType);
  
  return {
    signedUrl: result.data.signedUrl,
    contentType: result.data.contentType
  };
}

/**
 * Step 2: Upload the image file to S3 using the signed URL
 * @param signedUrl The signed S3 URL
 * @param contentType The content type from backend
 * @param imageFile The image file to upload
 * @returns Promise that resolves when upload is complete
 */
async function uploadToS3(
  signedUrl: string, 
  contentType: string,
  imageFile: File
): Promise<void> {
  try {
    console.log('Uploading to S3:', { 
      url: signedUrl, 
      fileName: imageFile.name, 
      contentType: contentType,
      size: imageFile.size 
    });
    
    // Convert File to ArrayBuffer for better compatibility
    const arrayBuffer = await imageFile.arrayBuffer();
    
    // Upload with Content-Type and Content-Disposition headers
    // These MUST match the headers used when generating the signed URL on the backend
    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
      },
      body: arrayBuffer,
    });

    console.log('S3 upload response:', { status: response.status, ok: response.ok });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error('S3 upload failed:', errorText);
      throw new Error(`Failed to upload image to S3: ${response.status} ${response.statusText}`);
    }
    
    console.log('✅ Successfully uploaded to S3');
  } catch (error) {
    console.error('S3 upload error:', error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to upload to S3. Please check your internet connection and CORS settings.');
    }
    throw error;
  }
}

/**
 * Complete flow: Get signed URL and upload image to S3
 * @param imageFile The image file to upload
 * @param apiKey The API key for authentication
 * @param accessToken Optional access token for authorization
 * @returns Promise with the final S3 URL (without query parameters)
 */
export async function uploadImageForSearch(
  imageFile: File,
  apiKey: string,
  accessToken?: string
): Promise<{ success: boolean; message: string; data: string }> {
  try {
    // Validate file
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(imageFile.type)) {
      throw new Error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Step 1: Get signed URL and content type from backend
    const { signedUrl, contentType } = await getSignedUploadUrl(
      imageFile.name, 
      apiKey, 
      accessToken
    );
    
    if (!signedUrl || !signedUrl.startsWith('http')) {
      throw new Error('Invalid signed URL received from server');
    }

    // Step 2: Upload file to S3 with backend-provided content type
    await uploadToS3(signedUrl, contentType, imageFile);

    // Extract the base URL without query parameters for the final result
    const finalUrl = signedUrl.split('?')[0];

    return {
      success: true,
      message: 'Image uploaded successfully',
      data: finalUrl,
    };
  } catch (error) {
    console.error('Image upload error:', error);
    throw error;
  }
}

/**
 * Create a preview URL for an image file
 * @param file The image file
 * @returns Object URL for preview
 */
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke an image preview URL to free memory
 * @param url The URL to revoke
 */
export function revokeImagePreview(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Format file size in human-readable format
 * @param bytes File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Compress an image file (optional utility for future use)
 * @param file The image file to compress
 * @param maxWidth Maximum width in pixels
 * @param maxHeight Maximum height in pixels
 * @param quality Quality from 0 to 1
 * @returns Compressed image as File
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          file.type,
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}
