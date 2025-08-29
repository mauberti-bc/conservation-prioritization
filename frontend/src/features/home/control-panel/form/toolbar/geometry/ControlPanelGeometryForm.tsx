import { mdiBroom, mdiCheck, mdiShapePolygonPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Button, IconButton, Stack } from '@mui/material';
import { TooltipPopover } from 'components/TooltipPopover';
import { FormValues } from 'features/home/control-panel/ControlPanel';
import { useFormikContext } from 'formik';
import { useDialogContext, useMapContext } from 'hooks/useContext';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { validateGeometry } from 'utils/spatial';

export const ControlPanelGeometryForm = () => {
  const { setFieldValue, values } = useFormikContext<FormValues>();
  const { mapRef, drawRef, drawControlsRef } = useMapContext();
  const dialogContext = useDialogContext();
  const [isDrawing, setIsDrawing] = useState(false);

  const handleStartDrawing = () => {
    if (!drawRef.current || !mapRef.current) {
      return;
    }
    drawControlsRef.current?.startDrawing();
    setIsDrawing(true);
  };

  const confirmClear = () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Clear All Areas of Interest',
      dialogText: `Are you sure you want to remove all drawn areas?`,
      onClose: () => dialogContext.setYesNoDialog({ open: false }),
      onNo: () => dialogContext.setYesNoDialog({ open: false }),
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        handleClear();
      },
    });
  };

  const handleClear = () => {
    if (!drawRef.current) {
      return;
    }
    drawControlsRef.current?.clearDrawing();
    setFieldValue('geometry', []);
    setIsDrawing(false);
  };

  const handleSubmit = useCallback(() => {
    drawControlsRef.current?.submit((features) => {
      const { isValid } = validateGeometry(features);
      if (!isValid) {
        return;
      }
      setFieldValue('geometry', features);
    });
    setIsDrawing(false);
  }, [drawControlsRef, setFieldValue]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleSubmit();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [handleSubmit]);

  const floatingFinishButton = isDrawing
    ? createPortal(
        <Box sx={{ position: 'fixed', top: 100, right: '5%', zIndex: 1300 }}>
          <Button
            sx={{ py: 2, px: 4 }}
            variant="contained"
            color="primary"
            startIcon={<Icon path={mdiCheck} size={1} />}
            onClick={handleSubmit}>
            Finish Drawing (Press Enter)
          </Button>
        </Box>,
        document.body
      )
    : null;

  return (
    <>
      <Stack
        height="100%"
        gap={0.5}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        width="100%"
        flexDirection="row">
        {isDrawing ? (
          <TooltipPopover tooltip="Finish Drawing (or press Enter)">
            <IconButton onClick={handleSubmit} aria-label="Finish Drawing" color="primary">
              <Icon path={mdiCheck} size={1} />
            </IconButton>
          </TooltipPopover>
        ) : (
          <TooltipPopover tooltip="Add Area of Interest">
            <span>
              <IconButton onClick={handleStartDrawing} disabled={isDrawing} aria-label="Add Area of Interest">
                <Icon path={mdiShapePolygonPlus} size={1} />
              </IconButton>
            </span>
          </TooltipPopover>
        )}

        <TooltipPopover tooltip={`Clear Areas (${values.geometry.length})`}>
          <span>
            <IconButton onClick={confirmClear} disabled={!values.geometry.length || isDrawing} aria-label="Clear Areas">
              <Icon path={mdiBroom} size={1} />
            </IconButton>
          </span>
        </TooltipPopover>
      </Stack>

      {floatingFinishButton}
    </>
  );
};
