import { EditDialog } from 'components/dialog/EditDialog';
import * as Yup from 'yup';
import { GeometryEditForm } from './form/GeometryEditForm';

interface Geometry {
  id: string;
  mapboxFeatureId: string;
  name: string;
  description: string | null;
  geojson: any;
}

interface GeometryEditDialogProps {
  open: boolean;
  geometry: Geometry;
  onCancel: () => void;
  onSave: (values: GeometryFormValues) => void;
}

interface GeometryFormValues {
  name: string;
  description: string;
}

const validationSchema = Yup.object({
  name: Yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: Yup.string().max(500, 'Description must be 500 characters or less'),
});

export const GeometryEditDialog = ({ open, geometry, onCancel, onSave }: GeometryEditDialogProps) => {
  const initialValues: GeometryFormValues = {
    name: geometry.name,
    description: geometry.description || '',
  };

  return (
    <EditDialog<GeometryFormValues>
      open={open}
      dialogTitle="Edit Area"
      dialogText="Update the name and description for this area."
      dialogSaveButtonLabel="Save"
      size="sm"
      onCancel={onCancel}
      onSave={onSave}
      component={{
        element: <GeometryEditForm />,
        initialValues,
        validationSchema,
      }}
    />
  );
};
