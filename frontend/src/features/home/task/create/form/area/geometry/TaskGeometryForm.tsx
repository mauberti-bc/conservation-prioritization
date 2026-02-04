import { mdiDelete, mdiPencil } from '@mdi/js';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { useFormikContext } from 'formik';
import { useState } from 'react';
import { GeometryEditDialog } from './edit/GeometryEditDialog';

interface Geometry {
  id: string;
  mapboxFeatureId: string;
  name: string;
  description: string | null;
  geojson: any;
}

interface TaskGeometryFormValues {
  geometry: Geometry[];
}

interface TaskGeometryFormProps {
  geometry: Geometry[];
  onDelete: (id: string) => void;
}

export const TaskGeometryForm = ({ geometry, onDelete }: TaskGeometryFormProps) => {
  const { setFieldValue } = useFormikContext<TaskGeometryFormValues>();
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
        g.id === editingGeometry.id ? { ...g, name: values.name, description: values.description } : g
      );
      setFieldValue('geometry', updatedGeometry);
      setEditingGeometry(null);
    }
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

            <IconMenuButton
              items={[
                { label: 'Edit', icon: mdiPencil, onClick: () => handleEditClick(g) },
                { label: 'Delete', icon: mdiDelete, onClick: () => onDelete(g.id) },
              ]}
            />
          </Paper>
        ))}
      </Stack>

      {editingGeometry && (
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
