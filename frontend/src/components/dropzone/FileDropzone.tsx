import { mdiCloudUploadOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Paper, Stack, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  label?: string;
  accept?: Record<string, string[]>;
  showExtensions?: boolean;
}

export const FileDropzone = ({ onFilesSelected, label, accept, showExtensions }: FileDropzoneProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
  });

  /** Flatten accepted extensions into readable list (e.g. ".geojson, .json") */
  const acceptedExtensions = useMemo(() => {
    if (!accept) {
      return null;
    }

    const extList = Object.values(accept).flat();
    if (extList.length === 0) {
      return null;
    }

    const uniqueExtensions = [...new Set(extList)];

    return uniqueExtensions.join(', ');
  }, [accept]);

  return (
    <Paper
      variant="outlined"
      {...getRootProps()}
      sx={{
        p: 2,
        borderStyle: 'dashed',
        borderColor: isDragActive ? 'primary.main' : grey[400],
        backgroundColor: isDragActive ? grey[100] : grey[50],
        cursor: 'pointer',
        transition: '0.2s',
        textAlign: 'center',
      }}>
      <input {...getInputProps()} />

      <Stack alignItems="center" gap={1} flexDirection="row" justifyContent="center">
        <Icon path={mdiCloudUploadOutline} size={1} color={grey[600]} />
        <Typography variant="body2" color={grey[600]} fontWeight={600}>
          {isDragActive ? 'Drop files to upload' : label} &zwnj;
          {showExtensions && (
            <Typography component="span" variant="caption">
              ({acceptedExtensions})
            </Typography>
          )}
        </Typography>
      </Stack>
    </Paper>
  );
};
