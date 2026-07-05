import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns";
import { id } from "date-fns/locale";

export const toTitleCase = (str: string | null | undefined) => {
  if (!str) return "-";
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const formatAddress = (addr: string | null | undefined) => {
  if (!addr) return "-";

  // Standardize to Title Case first
  let result = addr.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

  // Administrative abbreviations optimization
  const fixes = [
    { reg: /\bkp\.?\b/gi, res: "Kp." },
    { reg: /\brt\.?\b/gi, res: "RT" },
    { reg: /\brw\.?\b/gi, res: "RW" },
    { reg: /\brt\/rw\.?\b/gi, res: "RT/RW" },
    { reg: /\bdesa\.?\b/gi, res: "Desa" },
    { reg: /\bdes\.?\b/gi, res: "Desa" },
    { reg: /\bkecamatan\.?\b/gi, res: "Kecamatan" },
    { reg: /\bkec\.?\b/gi, res: "Kec." },
    { reg: /\bkabupaten\.?\b/gi, res: "Kabupaten" },
    { reg: /\bkab\.?\b/gi, res: "Kab." },
    { reg: /RT\/RW\.?(\d+)/gi, res: "RT/RW $1" },
    { reg: /Kab\.(\w+)/gi, res: "Kab. $1" }
  ];

  fixes.forEach(f => {
    result = result.replace(f.reg, f.res);
  });

  return result;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Compresses an image file using Canvas.
 * Returns a Blob that can be appended to FormData.
 */
export async function compressImage(
  file: File, 
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<Blob | File> {
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.7 } = options;

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
        if (!ctx) return reject(new Error("Could not get canvas context"));

        
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas toBlob failed"));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
    };
    reader.onerror = () => reject(new Error("Failed to read file for compression"));
  });
}

/**
 * Safely compresses an image. If the compression fails (e.g., due to canvas limits on older devices),
 * it gracefully falls back to returning the original file instead of throwing an error.
 */
export async function safeCompressImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<Blob | File> {
  try {
    return await compressImage(file, options);
  } catch (err) {
    console.warn("Image compression failed, falling back to original file:", err);
    return file;
  }
}

/**
 * Uploads a file with progress tracking.
 * Returns the URL of the uploaded file on the server.
 */
export function uploadFileWithProgress(
  file: Blob | File,
  onProgress: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload-single");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response.url);
        } catch (err) {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const response = JSON.parse(xhr.responseText);
          reject(new Error(response.message || "Upload failed"));
        } catch (err) {
          reject(new Error("Upload failed"));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error occurred during upload"));

    const formData = new FormData();
    formData.append("photo", file, (file as File).name || "upload.jpg");
    xhr.send(formData);
  });
}

/**
 * Formats a date into a long string in Indonesian format.
 * Example: Senin, 1 Januari 2026
 */
export const formatLongDate = (date: Date | string | number | null | undefined) => {
  if (!date) return "-";
  try {
    return format(new Date(date), "EEEE, d MMMM yyyy", { locale: id });
  } catch (err) {
    console.error("Error formatting date:", err);
    return "-";
  }
};
