import { mdiDeleteOutline, mdiImageFilterCenterFocusWeak, mdiPencilOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { useFormikContext } from 'formik';
import { Feature, GeoJsonProperties, Geometry as GeoJsonGeometry } from 'geojson';
import { useMapContext } from 'hooks/useContext';
import { useState } from 'react';
import { getFeatureBounds } from 'utils/spatial';
import { TaskCreateFormValues } from '../../TaskCreateForm';
import { GeometryEditDialog } from './edit/GeometryEditDialog';

interface Geometry {
  id: string;
  mapboxFeatureId: string;
  name: string;
  description: string | null;
  geojson: Feature<GeoJsonGeometry, GeoJsonProperties>;
}

interface TaskGeometryFormProps {
  geometry: Geometry[];
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}

export const TaskGeometryForm = ({ geometry, onDelete, isReadOnly = false }: TaskGeometryFormProps) => {
  const { setFieldValue } = useFormikContext<TaskCreateFormValues>();
  const { mapRef } = useMapContext();
  const [editingGeometry, setEditingGeometry] = useState<Geometry | null>(null);

  const handleEditClick = (g: Geometry) => {
    setEditingGeometry(g);
  };

  const handleEditCancel = () => {
    setEditingGeometry(null);
  };

  const handleEditSave = (values: { name: string; description: string }) => {
    if (editingGeometry) {
      const updatedGeometry = geometry.map((g) =>
        g.id === editingGeometry.id
          ? { ...g, name: values.name, description: values.description.trim() ? values.description : null }
          : g
      );
      setFieldValue('targetArea', updatedGeometry);
      setEditingGeometry(null);
    }
  };

  /**
   * Fits the shared map viewport to one persisted target-area feature.
   *
   * @param {Geometry} g Target-area item selected from the geometry list.
   * @returns {void} No return value.
   */
  const handleZoomToGeometry = (g: Geometry): void => {
    const map = mapRef.current;
    const bounds = getFeatureBounds(g.geojson);
    if (!map || !bounds) {
      return;
    }

    if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
      map.setCenter(bounds[0]);
      map.setZoom(12);
      return;
    }

    map.fitBounds(bounds, {
      padding: 64,
      maxZoom: 12,
    });
  };

  return (
    <>
      <Stack gap={0.5} flex="1 1 auto">
        {geometry.map((g) => (
          <Paper
            key={g.id}
            variant="outlined"
            sx={{
              py: 1,
              px: 2,
              bgcolor: grey[50],
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              overflow: 'hidden', // ensure content doesn't overflow Paper
            }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ flexShrink: 0 }}>
                {g.name}
              </Typography>
              {g.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  noWrap
                  sx={{ flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {g.description}
                </Typography>
              )}
            </Box>

            <IconButton
              aria-label={`Zoom to ${g.name}`}
              size="small"
              onClick={() => {
                handleZoomToGeometry(g);
              }}>
              <Icon path={mdiImageFilterCenterFocusWeak} size={0.8} />
            </IconButton>

            {!isReadOnly && (
              <Box
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                }}>
                <IconMenuButton
                  items={[
                    { label: 'Edit', icon: mdiPencilOutline, onClick: () => handleEditClick(g) },
                    {
                      label: 'Delete',
                      icon: mdiDeleteOutline,
                      color: 'error',
                      dividerBefore: true,
                      onClick: () => onDelete(g.id),
                    },
                  ]}
                />
              </Box>
            )}
          </Paper>
        ))}
      </Stack>

      {editingGeometry && !isReadOnly && (
        <GeometryEditDialog
          open={!!editingGeometry}
          geometry={editingGeometry}
          onCancel={handleEditCancel}
          onSave={handleEditSave}
        />
      )}
    </>
  );
};
