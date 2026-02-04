import { mdiCheck, mdiShapePolygonPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Button, Typography } from '@mui/material';
import { FileDropzone } from 'components/dropzone/FileDropzone';
import { TooltipStack } from 'components/tooltip/TooltipStack';
import { TooltipPopover } from 'components/TooltipPopover';
import { useFormikContext } from 'formik';
import { useMapContext } from 'hooks/useContext';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { validateGeometry } from 'utils/spatial';
import { v4 } from 'uuid';
import { FormValues } from '../ControlPanelForm';
import { ControlPanelGeometryForm } from './geometry/ControlPanelGeometryForm';

export const ControlPanelAreaForm = () => {
  const { values, setFieldValue } = useFormikContext<FormValues>();
  const { drawControlsRef, mapRef, drawRef } = useMapContext();
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = useCallback(() => {
    if (!drawRef.current || !mapRef.current || !drawControlsRef.current) {
      return;
    }
    drawControlsRef.current?.startDrawing();
    setIsDrawing(true);
  }, [drawControlsRef, drawRef, mapRef]);

  const finishDrawing = useCallback(() => {
    if (!drawControlsRef.current) {
      return;
    }
    drawControlsRef.current.submit((features) => {
      const { isValid } = validateGeometry(features);
      if (!isValid || features.length === 0) {
        return;
      }
      const newFeature = features[0];
      const newGeometry = {
        id: v4(),
        name: `Area ${values.geometry.length + 1}`,
        description: null,
        geojson: newFeature,
        mapboxFeatureId: newFeature.id,
      };
      setFieldValue('geometry', [...values.geometry, newGeometry]);
      setIsDrawing(false);
    });
  }, [drawControlsRef, setFieldValue, values.geometry]);

  const handleDelete = useCallback(
    (id: string) => {
      const featureToDelete = values.geometry.find((g) => g.id === id);
      if (featureToDelete && drawRef.current && featureToDelete.mapboxFeatureId) {
        drawRef.current.delete(featureToDelete.mapboxFeatureId);
      }
      setFieldValue(
        'geometry',
        values.geometry.filter((g) => g.id !== id)
      );
    },
    [values.geometry, setFieldValue, drawRef]
  );

  /** Handle Enter key to finish drawing */
  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (isDrawing && e.key === 'Enter') {
        e.preventDefault();
        finishDrawing();
      }
    },
    [isDrawing, finishDrawing]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

  const floatingFinishButton = isDrawing
    ? createPortal(
        <Box
          sx={{
            position: 'fixed',
            top: 100,
            right: '5%',
            zIndex: 1300,
          }}>
          <Button
            sx={{ py: 2, px: 4 }}
            variant="contained"
            color="primary"
            startIcon={<Icon path={mdiCheck} size={1} />}
            onClick={finishDrawing}>
            Finish Drawing (Press Enter)
          </Button>
        </Box>,
        document.body
      )
    : null;

  return (
    <>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
        <TooltipStack tooltip="Limit solutions to areas of interest">
          <Typography
            color="textSecondary"
            fontWeight={700}
            textTransform="uppercase"
            letterSpacing={0.5}
            variant="body2">
            Areas
          </Typography>
        </TooltipStack>
        <TooltipPopover tooltip={isDrawing ? 'Finish Drawing' : 'Add Area'}>
          <span>
            <Button
              onClick={isDrawing ? finishDrawing : startDrawing}
              aria-label={isDrawing ? 'Finish Drawing' : 'Add Area'}
              color="primary"
              startIcon={<Icon path={isDrawing ? mdiCheck : mdiShapePolygonPlus} size={0.9} />}
              sx={{ whiteSpace: 'nowrap' }}>
              {isDrawing ? 'Finish Drawing' : 'Draw Area'}
            </Button>
          </span>
        </TooltipPopover>
      </Box>

      <Box>
        <FileDropzone
          label="Upload areas of interest"
          accept={{
            'application/geo+json': ['.geojson'],
            'application/json': ['.json'],
            'application/zip': ['.zip'],
            'application/x-zip-compressed': ['.zip'],
          }}
          onFilesSelected={(files) => console.log(files)}
        />
      </Box>

      {values.geometry.length > 0 ? (
        <Box mt={1}>
          <ControlPanelGeometryForm geometry={values.geometry} onDelete={handleDelete} />
        </Box>
      ) : null}

      {floatingFinishButton}
    </>
  );
};
