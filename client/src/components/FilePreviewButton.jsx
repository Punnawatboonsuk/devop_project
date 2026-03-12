import React, { useState } from 'react';
import FilePreviewModal from './FilePreviewModal';

const FilePreviewButton = ({ file, className = '', children }) => {
  const [open, setOpen] = useState(false);

  if (!file) return null;

  const fileId = file.id;
  const name = file.original_name || file.name || 'ไฟล์แนบ';
  const mimeType = file.mime_type || file.mimeType || '';
  const url = fileId ? `/api/uploads/file/${fileId}/view` : file.url;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <FilePreviewModal
        open={open}
        onClose={() => setOpen(false)}
        file={{ url, name, mimeType }}
      />
    </>
  );
};

export default FilePreviewButton;
