import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { useMapContext } from 'hooks/useContext';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DrawControls } from '../../map/draw/DrawControls';
import { MapContainer } from '../../map/MapContainer';
import { CreateTaskForm } from './CreateTask';

export const CreateTaskDialogRoute = () => {
  const navigate = useNavigate();
  const { drawControlsRef } = useMapContext();
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
    <Dialog
      open
      fullWidth
      maxWidth="xl"
      onClose={handleClose}
      PaperProps={{
        sx: {
          height: 'calc(100vh - 64px)',
          maxHeight: 'none',
        },
      }}>
      <DialogTitle sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={600}>
            Create Task
          </Typography>
          <IconButton aria-label="Close create task" onClick={handleClose} size="small">
            <Icon path={mdiClose} size={1} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
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
            }}>
            <CreateTaskForm
              submitRef={submitRef}
              hideInternalActions
              onSubmittingChange={setIsSubmitting}
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
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={handleClose}>
          Close
        </Button>
        <LoadingButton variant="contained" onClick={handleSubmit} loading={isSubmitting}>
          Submit
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
