import { supabase } from './supabase';

const BUCKET_NAME = 'chart-image';

/**
 * MIME 타입에서 파일 확장자를 추출합니다.
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };

  return mimeToExt[mimeType.toLowerCase()] || 'png';
}

/**
 * 타임스탬프 기반 파일명을 생성합니다.
 * 형식: {timestamp}.{extension}
 */
function generateFileName(mimeType: string): string {
  const timestamp = Date.now();
  const extension = getExtensionFromMimeType(mimeType);
  return `${timestamp}.${extension}`;
}

/**
 * Base64 이미지 데이터를 Supabase Storage에 업로드하고 공개 URL을 반환합니다.
 * 
 * @param base64Data - Base64 인코딩된 이미지 데이터 (data URL이 아닌 순수 base64 문자열)
 * @param mimeType - 이미지의 MIME 타입 (예: 'image/png')
 * @returns 업로드된 이미지의 공개 URL
 */
export async function uploadImageToStorage(
  base64Data: string,
  mimeType: string = 'image/png'
): Promise<string> {
  try {
    // Base64 데이터를 Buffer로 변환
    const base64String = base64Data.includes(',') 
      ? base64Data.split(',')[1] 
      : base64Data;
    
    const buffer = Buffer.from(base64String, 'base64');

    // 파일명 생성
    const fileName = generateFileName(mimeType);

    // Storage에 업로드
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false, // 동일한 파일명이 있으면 오류 발생
      });

    if (error) {
      console.error('이미지 업로드 오류:', error);
      throw new Error(`이미지 업로드 실패: ${error.message}`);
    }

    if (!data) {
      throw new Error('이미지 업로드 실패: 데이터가 반환되지 않았습니다.');
    }

    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('공개 URL 생성 실패');
    }

    console.log('✅ 이미지 업로드 성공:', {
      fileName,
      url: urlData.publicUrl,
    });

    return urlData.publicUrl;
  } catch (error) {
    console.error('이미지 업로드 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 여러 이미지를 한 번에 업로드합니다.
 * 
 * @param images - 업로드할 이미지 배열 (base64 데이터와 MIME 타입)
 * @returns 업로드된 이미지의 공개 URL 배열
 */
export async function uploadImagesToStorage(
  images: Array<{ data: string; mimeType?: string }>
): Promise<string[]> {
  const uploadPromises = images.map((img) =>
    uploadImageToStorage(img.data, img.mimeType || 'image/png')
  );

  return Promise.all(uploadPromises);
}

