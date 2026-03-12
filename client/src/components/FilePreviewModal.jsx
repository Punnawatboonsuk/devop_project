import React from 'react';
import { X } from 'lucide-react';

const isPdf = (mimeType = '', name = '') =>
  mimeType.toLowerCase().includes('pdf') || name.toLowerCase().endsWith('.pdf');

const isImage = (mimeType = '', name = '') =>
  mimeType.toLowerCase().startsWith('image/') ||
  /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);

const FilePreviewModal = ({ open, onClose, file }) => {
  if (!open || !file) return null;

  const { url, name, mimeType } = file;
  const previewPdf = isPdf(mimeType, name);
  const previewImage = isImage(mimeType, name);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-800 truncate">{name || 'ไฟล์แนบ'}</h3>
            <p className="text-xs text-gray-500 truncate">{mimeType || ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-gray-50 p-3">
          {previewPdf && (
            <iframe
              title={name || 'preview'}
              src={url}
              className="w-full h-[70vh] bg-white rounded-lg border border-gray-200"
            />
          )}
          {previewImage && (
            <div className="flex items-center justify-center">
              <img src={url} alt={name || 'preview'} className="max-h-[70vh] max-w-full rounded-lg border border-gray-200" />
            </div>
          )}
          {!previewPdf && !previewImage && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-600">
              รองรับเฉพาะไฟล์ PDF หรือรูปภาพเท่านั้น
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
