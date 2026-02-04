import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from '@mui/material';
import { MapContextProvider } from 'context/mapContext';
import { useMapContext } from 'hooks/useContext';
import { MutableRefObject, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DrawControls } from '../../map/draw/DrawControls';
import { MapContainer } from '../../map/MapContainer';
import { CreateTask } from './CreateTask';

export const CreateTaskDialog = () => {
  const navigate = useNavigate();
  const submitRef = useRef<(() => void) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    navigate('/t/?v=tasks');
  };

  const handleSubmit = () => {
    if (!submitRef.current || isSubmitting) {
      return;
    }
    submitRef.current();
  };

  return (
    <MapContextProvider>
      <CreateTaskDialogContent
        submitRef={submitRef}
        isSubmitting={isSubmitting}
        onSubmittingChange={setIsSubmitting}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    </MapContextProvider>
  );
};

interface CreateTaskDialogContentProps {
  submitRef: MutableRefObject<(() => void) | null>;
  isSubmitting: boolean;
  onSubmittingChange: (isSubmitting: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const CreateTaskDialogContent = ({
  submitRef,
  isSubmitting,
  onSubmittingChange,
  onClose,
  onSubmit,
}: CreateTaskDialogContentProps) => {
  const navigate = useNavigate();
  const { drawControlsRef } = useMapContext();

  return (
    <Dialog
      open
      fullWidth
      maxWidth="xl"
      onClose={onClose}
      PaperProps={{
        sx: {
          height: 'calc(100vh - 64px)',
          maxHeight: 'none',
        },
      }}>
      <DialogTitle
        sx={{
          p: 2,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          zIndex: 1,
        }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={600}>
            Create Task
          </Typography>
          <IconButton aria-label="Close create task" onClick={onClose} size="small">
            <Icon path={mdiClose} size={1} />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: '0 !important', height: '100%', overflow: 'hidden', m: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            height: '100%',
          }}>
          <Box
            sx={{
              borderRight: { md: '1px solid' },
              borderColor: 'divider',
              minHeight: 0,
              height: '100%',
              overflow: 'auto',
              py: 2,
            }}>
            <CreateTask
              submitRef={submitRef}
              hideInternalActions
              onSubmittingChange={onSubmittingChange}
              onSubmitSuccess={() => {
                navigate('/t/?v=tasks');
              }}
            />
          </Box>
          <Box sx={{ position: 'relative', minHeight: 0, height: '100%' }}>
            <MapContainer pmtilesUrls={[]} />
            <DrawControls ref={drawControlsRef} />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          justifyContent: 'flex-end',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          zIndex: 1,
        }}>
        <LoadingButton variant="contained" onClick={onSubmit} loading={isSubmitting}>
          Submit
        </LoadingButton>
        <Button variant="outlined" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
